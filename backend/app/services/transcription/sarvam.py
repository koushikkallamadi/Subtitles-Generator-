import os
import json
import re
import logging
import asyncio
import tempfile
import subprocess
import unicodedata
import httpx
from typing import List, Optional, Tuple
from app.core.settings import settings
from app.services.transcription.base import (
    BaseTranscriptionProvider,
    TranscriptionResult,
    WordTimestamp,
    Segment,
)
from app.services.media import get_media_duration, chunk_audio, extract_audio, get_ffprobe_cmd, get_ffmpeg_cmd
from app.services.transcription.groq import GroqProvider
from app.services.transcription.timing import merge_whisper_timings

logger = logging.getLogger(__name__)

SARVAM_LANGUAGE_MAP = {
    "hindi": "hi-IN",
    "hi": "hi-IN",
    "english": "en-IN",
    "en": "en-IN",
    "urdu": "ur-IN",
    "ur": "ur-IN",
    "tamil": "ta-IN",
    "ta": "ta-IN",
    "marathi": "mr-IN",
    "mr": "mr-IN",
    "telugu": "te-IN",
    "te": "te-IN",
    "kannada": "kn-IN",
    "kn": "kn-IN",
    "malayalam": "ml-IN",
    "ml": "ml-IN",
    "bengali": "bn-IN",
    "bn": "bn-IN",
    "gujarati": "gu-IN",
    "gu": "gu-IN",
    "punjabi": "pa-IN",
    "pa": "pa-IN",
    "odia": "od-IN",
    "or": "od-IN",
    "auto-detect": "unknown",
    "auto": "unknown",
}

class SarvamProvider(BaseTranscriptionProvider):
    @property
    def name(self) -> str:
        return "sarvam"

    def is_configured(self) -> bool:
        return bool(settings.SARVAM_API_KEY and settings.SARVAM_API_KEY.strip())

    def _get_language_code(self, language: Optional[str]) -> str:
        if not language:
            return "unknown"
        return SARVAM_LANGUAGE_MAP.get(language.lower().strip(), "unknown")

    def _get_mode(self, language: Optional[str], style: Optional[str]) -> str:
        lang_lower = (language or "").lower()
        if lang_lower in ["english", "en"]:
            return "transcribe"
        # Keep native-script output while aligning. The manager converts this to
        # Roman text afterwards and preserves its 1:1 timings.
        return "transcribe"

    async def _hybrid_word_timings(
        self, audio_path: str, language: Optional[str], words: List[WordTimestamp], estimated: bool,
    ) -> Tuple[List[WordTimestamp], str]:
        if not estimated:
            return words, "aligned"
        if settings.TIMING_STRATEGY != "hybrid":
            return words, "estimated"
        try:
            whisper_language = (language or "").split("-", 1)[0]
            whisper = await GroqProvider().transcribe(audio_path, language=whisper_language, style="native")
            merged, match_ratio = merge_whisper_timings(words, whisper.words)
            audio_seconds = get_media_duration(audio_path)
            logger.info(
                "Timing hybrid usage: Groq Whisper processed %.3f audio seconds; matched %.1f%% of Sarvam words",
                audio_seconds, match_ratio * 100,
            )
            if match_ratio >= 0.40:
                return merged, "aligned" if match_ratio >= 0.60 else "estimated"
            logger.warning("Timing hybrid fell back to speech-region estimates: %.1f%% word match rate", match_ratio * 100)
        except Exception as error:
            logger.warning("Timing hybrid fell back to speech-region estimates because Groq Whisper failed: %s", error)
        return words, "estimated"

    @staticmethod
    def _word_weight(word: str) -> int:
        """Approximate syllables for Latin words and grapheme count for Indic words."""
        if re.search(r"[A-Za-z]", word):
            groups = re.findall(r"[aeiouy]+", word.casefold())
            return max(1, len(groups))
        try:
            import regex
            return max(1, len(regex.findall(r"\X", word)))
        except ImportError:
            return max(1, sum(1 for char in word if not unicodedata.category(char).startswith("M")))

    def _detect_speech_regions(self, audio_path: str, duration: float, offset: float = 0.0) -> List[Tuple[float, float]]:
        """Return speech spans using ffmpeg's silence detector; times are global audio seconds."""
        if duration <= 0:
            return []
        command = [get_ffmpeg_cmd(), "-hide_banner", "-i", audio_path, "-vn", "-af", "silencedetect=noise=-32dB:d=0.18", "-f", "null", "-"]
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            logger.warning("Speech-region detection failed; estimating across timestamp spans")
            return []

        silences: List[Tuple[float, float]] = []
        silence_start: Optional[float] = None
        for line in result.stderr.splitlines():
            start_match = re.search(r"silence_start:\s*([0-9.]+)", line)
            end_match = re.search(r"silence_end:\s*([0-9.]+)", line)
            if start_match:
                silence_start = float(start_match.group(1))
            if end_match and silence_start is not None:
                silences.append((silence_start, float(end_match.group(1))))
                silence_start = None
        if silence_start is not None:
            silences.append((silence_start, duration))

        regions: List[Tuple[float, float]] = []
        cursor = 0.0
        for silence_start, silence_end in silences:
            silence_start = min(duration, max(cursor, silence_start))
            silence_end = min(duration, max(silence_start, silence_end))
            if silence_start - cursor >= 0.06:
                if regions and cursor - regions[-1][1] < 0.10:
                    regions[-1] = (regions[-1][0], silence_start)
                else:
                    regions.append((cursor, silence_start))
            cursor = max(cursor, silence_end)
        if duration - cursor >= 0.06:
            regions.append((cursor, duration))
        return [(start + offset, end + offset) for start, end in regions]

    def _estimate_word_timings(
        self, text: str, start: float, end: float,
        speech_regions: Optional[List[Tuple[float, float]]] = None,
    ) -> List[WordTimestamp]:
        tokens = [word for word in text.strip().split() if word]
        if not tokens or end <= start:
            return []
        weights = [self._word_weight(word) for word in tokens]
        regions = [(max(start, left), min(end, right)) for left, right in (speech_regions or []) if right > start and left < end]
        regions = [(left, right) for left, right in regions if right - left >= 0.06]
        if not regions:
            regions = [(start, end)]

        # Assign adjacent words to each detected speech run in proportion to its duration.
        # This preserves real silent gaps instead of spreading a phrase over them.
        groups: List[List[str]] = []
        word_cursor = 0
        remaining_weight = float(sum(weights))
        remaining_duration = sum(right - left for left, right in regions)
        for region_index, (left, right) in enumerate(regions):
            remaining_regions = len(regions) - region_index
            remaining_words = len(tokens) - word_cursor
            if region_index == len(regions) - 1:
                count = remaining_words
            else:
                target = remaining_weight * (right - left) / max(remaining_duration, 0.001)
                max_count = max(1, remaining_words - remaining_regions + 1)
                count = min(range(1, max_count + 1), key=lambda amount: abs(sum(weights[word_cursor:word_cursor + amount]) - target))
            groups.append(tokens[word_cursor:word_cursor + count])
            assigned_weight = sum(weights[word_cursor:word_cursor + count])
            word_cursor += count
            remaining_weight -= assigned_weight
            remaining_duration -= right - left

        output: List[WordTimestamp] = []
        for (left, right), group in zip(regions, groups):
            if not group:
                continue
            group_weights = [self._word_weight(word) for word in group]
            span = right - left
            gap = min(0.035, span / max(4 * len(group), 1))
            speech_span = max(0.001, span - gap * (len(group) - 1))
            min_duration = min(0.08, speech_span / len(group))
            durations = [max(min_duration, speech_span * weight / sum(group_weights)) for weight in group_weights]
            total = sum(durations)
            if total > speech_span:
                durations = [value * speech_span / total for value in durations]
            cursor = left
            for index, (word, word_duration) in enumerate(zip(group, durations)):
                word_end = min(right, cursor + word_duration)
                if word_end <= cursor:
                    word_end = min(right, cursor + 0.001)
                output.append(WordTimestamp(text=word, start=round(cursor, 4), end=round(word_end, 4)))
                cursor = word_end + (gap if index < len(group) - 1 else 0.0)
        return output

    def _parse_timestamps(
        self,
        timestamps_data: Optional[dict],
        raw_words: Optional[list],
        transcript: str,
        time_offset: float,
        duration: float,
        speech_regions: Optional[List[Tuple[float, float]]] = None,
    ) -> Tuple[List[WordTimestamp], bool]:
        """
        Parses timestamps from Sarvam API response.
        Returns (words, timestamps_estimated).
        """
        words: List[WordTimestamp] = []
        timestamps_estimated = False

        if isinstance(timestamps_data, dict) and "words" in timestamps_data:
            chunk_texts = timestamps_data.get("words", [])
            starts = timestamps_data.get("start_time_seconds", [])
            ends = timestamps_data.get("end_time_seconds", [])

            # Check if Sarvam returned chunk-level entries (strings with spaces) or individual words
            has_multiword_chunks = any(" " in str(c).strip() for c in chunk_texts if c)

            if has_multiword_chunks:
                timestamps_estimated = True
                logger.warning(
                    f"[TIMESTAMPS ESTIMATED] Sarvam returned chunk-level segments ({len(chunk_texts)} chunks). "
                    "Estimating word-level timestamps across chunks."
                )
                for i, chunk_txt in enumerate(chunk_texts):
                    if not chunk_txt:
                        continue
                    c_start = (float(starts[i]) if i < len(starts) else 0.0) + time_offset
                    c_end = (float(ends[i]) if i < len(ends) else c_start + 1.0) + time_offset
                    chunk_word_objs = self._estimate_word_timings(str(chunk_txt), c_start, c_end, speech_regions)
                    words.extend(chunk_word_objs)
            else:
                # Real word-level timestamps
                for i, w in enumerate(chunk_texts):
                    if w and str(w).strip():
                        w_start = (float(starts[i]) if i < len(starts) else 0.0) + time_offset
                        w_end = (float(ends[i]) if i < len(ends) else w_start + 0.3) + time_offset
                        words.append(
                            WordTimestamp(text=str(w).strip(), start=round(w_start, 3), end=round(w_end, 3))
                        )
                logger.info(f"[TIMESTAMPS REAL] Sarvam returned {len(words)} real word-level timestamps.")

        elif raw_words and isinstance(raw_words, list) and len(raw_words) > 0 and isinstance(raw_words[0], dict):
            for item in raw_words:
                w_text = item.get("word") or item.get("text", "")
                w_start = float(item.get("start_time", item.get("start", 0.0))) + time_offset
                w_end = float(item.get("end_time", item.get("end", w_start + 0.3))) + time_offset
                if w_text.strip():
                    words.append(
                        WordTimestamp(text=w_text.strip(), start=round(w_start, 3), end=round(w_end, 3))
                    )
            logger.info(f"[TIMESTAMPS REAL] Sarvam returned {len(words)} real word-level timestamps.")
        else:
            timestamps_estimated = True
            logger.warning(
                f"[TIMESTAMPS ESTIMATED] Sarvam returned no word-level timestamps. "
                "Estimating word timings across full audio duration."
            )
            words = self._estimate_word_timings(transcript, time_offset, time_offset + duration, speech_regions)

        return words, timestamps_estimated

    async def _transcribe_sync_chunk(
        self,
        chunk_path: str,
        time_offset: float,
        language_code: str,
        mode: str,
    ) -> Tuple[str, List[WordTimestamp], List[Segment], bool, str]:
        """Call Sarvam synchronous /speech-to-text endpoint for a single chunk <= 30s."""
        url = "https://api.sarvam.ai/speech-to-text"
        headers = {
            "api-subscription-key": settings.SARVAM_API_KEY.strip(),
        }

        with open(chunk_path, "rb") as f:
            file_bytes = f.read()

        filename = os.path.basename(chunk_path)
        data = {
            "model": "saaras:v4",
            "mode": mode,
            "language_code": language_code,
            "with_timestamps": "true",
        }
        files = {
            "file": (filename, file_bytes, "audio/mpeg"),
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, data=data, files=files)

        if response.status_code != 200:
            if "model" in response.text.lower():
                data["model"] = "saaras:v3"
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(url, headers=headers, data=data, files=files)

        if response.status_code != 200:
            raise RuntimeError(f"Sarvam API error ({response.status_code}): {response.text}")

        res_data = response.json()
        transcript = res_data.get("transcript", "").strip()

        # If transcribe mode returned empty string, try codemix
        if not transcript and mode == "transcribe":
            logger.info("Sarvam transcribe mode returned empty transcript; retrying with codemix mode...")
            data["mode"] = "codemix"
            async with httpx.AsyncClient(timeout=60.0) as client:
                res2 = await client.post(url, headers=headers, data=data, files=files)
            if res2.status_code == 200:
                res_data = res2.json()
                transcript = res_data.get("transcript", "").strip()

        chunk_duration = get_media_duration(chunk_path) or 10.0
        speech_regions = self._detect_speech_regions(chunk_path, chunk_duration, time_offset)
        words, timestamps_estimated = self._parse_timestamps(
            res_data.get("timestamps"),
            res_data.get("words"),
            transcript,
            time_offset,
            chunk_duration,
            speech_regions,
        )
        words, timing_quality = await self._hybrid_word_timings(
            chunk_path, language_code, words, timestamps_estimated,
        )

        chunk_segments = [
            Segment(
                start=time_offset,
                end=time_offset + chunk_duration,
                text=transcript,
                words=words,
            )
        ]

        return transcript, words, chunk_segments, timestamps_estimated, timing_quality

    def _chunk_by_silence(self, audio_path: str, min_chunk: float = 5.0, max_chunk: float = 10.0) -> List[Tuple[str, float]]:
        """Split audio at silence points using ffmpeg silencedetect.
        Returns a list of (chunk_file_path, start_offset). Ensures first chunk starts at 0.0.
        """
        # Get total duration
        total_duration = get_media_duration(audio_path)
        if total_duration <= max_chunk:
            return [(audio_path, 0.0)]
        # Run ffmpeg silencedetect to get silence intervals
        ffmpeg = get_ffmpeg_cmd()
        silencedetect_cmd = [
            ffmpeg, "-i", audio_path, "-vn",
            "-af", "silencedetect=noise=-30dB:d=0.3",
            "-f", "null", "-"
        ]
        result = subprocess.run(silencedetect_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        silence_times = []
        for line in result.stderr.splitlines():
            if "silence_start" in line:
                parts = line.strip().split('silence_start:')
                try:
                    start = float(parts[1].strip())
                    silence_times.append((start, None))
                except:
                    pass
            if "silence_end" in line:
                parts = line.strip().split('silence_end:')
                if len(parts) > 1:
                    sub = parts[1].split('|')
                    try:
                        end = float(sub[0].strip())
                        # attach to last tuple
                        if silence_times and silence_times[-1][1] is None:
                            silence_times[-1] = (silence_times[-1][0], end)
                    except:
                        pass
        # Prefer the midpoint of a detected silence near each 7 s target.
        # If speech has no silence in range, fall back to a hard max-length boundary.
        silence_points = [
            (start + end) / 2.0
            for start, end in silence_times
            if end is not None and end - start >= 0.18
        ]
        chunks: List[Tuple[float, float]] = []
        current = 0.0
        while total_duration - current > max_chunk:
            candidates = [point for point in silence_points if current + min_chunk <= point <= current + max_chunk]
            boundary = min(candidates, key=lambda point: abs(point - (current + 7.0))) if candidates else current + max_chunk
            chunks.append((current, boundary))
            current = boundary
        if total_duration - current > 0:
            if chunks and total_duration - current < min_chunk:
                previous_start, _ = chunks[-1]
                if total_duration - previous_start <= max_chunk:
                    chunks[-1] = (previous_start, total_duration)
                else:
                    chunks.append((current, total_duration))
            else:
                chunks.append((current, total_duration))

        # Re-encode chunks to sample-accurate PCM. Stream-copying MP3 could
        # introduce frame-sized seek errors that accumulate at every boundary.
        result_chunks: List[Tuple[str, float]] = []
        for idx, (s, e) in enumerate(chunks):
            duration = e - s
            chunk_file = os.path.join(
                tempfile.gettempdir(),
                f"chunk_{os.path.basename(audio_path)}_{idx}.wav"
            )
            cmd = [
                ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                "-i", audio_path, "-ss", f"{s:.6f}", "-t", f"{duration:.6f}",
                "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
                chunk_file,
            ]
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            result_chunks.append((chunk_file, s))
        return result_chunks

    def _postprocess_transcript(self, transcript: str, words: List[WordTimestamp]) -> Tuple[str, List[WordTimestamp]]:
        """Clean transcript:
        - Remove isolated solitary period tokens.
        - Collapse duplicate letters in English words (e.g., installl -> install).
        Adjust word list accordingly.
        """
        # Remove solitary '.' tokens
        tokens = transcript.split()
        cleaned_tokens = [t for t in tokens if t != '.']
        # Collapse double letters for pure ASCII words
        def collapse(word: str) -> str:
            if word.isascii():
                return re.sub(r'(.)\1{1,}', r'\1', word)
            return word
        cleaned_tokens = [collapse(t) for t in cleaned_tokens]
        cleaned_transcript = " ".join(cleaned_tokens)
        # Align words list (simple approach: filter corresponding words)
        cleaned_words = []
        for w in words:
            txt = collapse(w.text)
            if txt == '.':
                continue
            cleaned_words.append(WordTimestamp(text=txt, start=w.start, end=w.end))
        return cleaned_transcript, cleaned_words

    async def _transcribe_batch_api(
        self,
        audio_path: str,
        language_code: str,
        mode: str,
    ) -> Optional[TranscriptionResult]:
        """
        Sarvam Batch Speech-to-Text API:
        1. POST /speech-to-text/job/v1 (JSON body)
        2. POST /speech-to-text/job/v1/upload-files (JSON body)
        3. PUT audio file to presigned URL
        4. POST /speech-to-text/job/v1/{job_id}/start
        5. Poll /speech-to-text/job/v1/{job_id}/status
        6. POST /speech-to-text/job/v1/download-files
        """
        api_key = settings.SARVAM_API_KEY.strip()
        headers = {
            "api-subscription-key": api_key,
            "Content-Type": "application/json",
        }

        try:
            # 1. Create bulk job with correct JSON payload
            job_payload = {
                "job_parameters": {
                    "model": "saaras:v4",
                    "mode": mode,
                    "with_timestamps": True,
                    "with_diarization": False,
                    "language_code": language_code,
                }
            }
            logger.info("Submitting Sarvam batch job request...")
            async with httpx.AsyncClient(timeout=30.0) as client:
                res_create = await client.post(
                    "https://api.sarvam.ai/speech-to-text/job/v1",
                    headers=headers,
                    json=job_payload,
                )

            if res_create.status_code not in (200, 201, 202):
                logger.warning(
                    f"Sarvam batch job submission returned {res_create.status_code}: body: {res_create.text}"
                )
                return None

            job_data = res_create.json()
            job_id = job_data.get("job_id")
            if not job_id:
                logger.warning("No job_id in Sarvam batch job response.")
                return None

            logger.info(f"Sarvam batch job created: {job_id}")

            # 2. Get presigned upload URL
            filename = os.path.basename(audio_path)
            upload_payload = {"job_id": job_id, "files": [filename]}
            async with httpx.AsyncClient(timeout=30.0) as client:
                res_upload = await client.post(
                    "https://api.sarvam.ai/speech-to-text/job/v1/upload-files",
                    headers=headers,
                    json=upload_payload,
                )

            if res_upload.status_code != 200:
                logger.warning(f"Sarvam batch upload-files returned {res_upload.status_code}: {res_upload.text}")
                return None

            upload_urls = res_upload.json().get("upload_urls", {})
            file_meta = upload_urls.get(filename)
            if not file_meta or "file_url" not in file_meta:
                logger.warning(f"Missing file_url in Sarvam upload-files response for {filename}")
                return None

            presigned_put_url = file_meta["file_url"]

            # 3. Upload audio file content to presigned URL
            with open(audio_path, "rb") as f:
                audio_bytes = f.read()

            content_type = "audio/wav" if filename.endswith(".wav") else "audio/mpeg"
            async with httpx.AsyncClient(timeout=90.0) as client:
                res_put = await client.put(
                    presigned_put_url,
                    content=audio_bytes,
                    headers={"Content-Type": content_type},
                )

            if res_put.status_code not in (200, 201, 204):
                logger.warning(f"Sarvam S3 upload failed with status {res_put.status_code}")
                return None

            logger.info(f"Uploaded audio ({len(audio_bytes)} bytes) to Sarvam S3 storage.")

            # 4. Start the job
            async with httpx.AsyncClient(timeout=30.0) as client:
                res_start = await client.post(
                    f"https://api.sarvam.ai/speech-to-text/job/v1/{job_id}/start",
                    headers=headers,
                )

            if res_start.status_code != 200:
                logger.warning(f"Sarvam batch job start returned {res_start.status_code}: {res_start.text}")
                return None

            logger.info(f"Sarvam batch job {job_id} started successfully. Polling for results...")

            # 5. Poll for completion (up to 120s)
            status_url = f"https://api.sarvam.ai/speech-to-text/job/v1/{job_id}/status"
            job_details = None
            for poll_idx in range(40):
                await asyncio.sleep(3.0)
                async with httpx.AsyncClient(timeout=30.0) as client:
                    poll_res = await client.get(status_url, headers={"api-subscription-key": api_key})

                if poll_res.status_code == 200:
                    poll_data = poll_res.json()
                    state = poll_data.get("job_state", "")
                    if state == "Completed":
                        job_details = poll_data.get("job_details", [])
                        logger.info(f"Sarvam batch job {job_id} completed successfully.")
                        break
                    elif state in ("Failed", "error"):
                        logger.error(f"Sarvam batch job {job_id} failed: {poll_data}")
                        return None

            if not job_details:
                logger.warning(f"Sarvam batch job {job_id} timed out or produced no job_details.")
                return None

            # 6. Request download URL for output
            outputs = job_details[0].get("outputs", []) if job_details else []
            out_filename = outputs[0].get("file_name", "0.json") if outputs else "0.json"

            async with httpx.AsyncClient(timeout=30.0) as client:
                dl_res = await client.post(
                    "https://api.sarvam.ai/speech-to-text/job/v1/download-files",
                    headers=headers,
                    json={"job_id": job_id, "files": [out_filename]},
                )

            if dl_res.status_code != 200:
                logger.warning(f"Sarvam download-files returned {dl_res.status_code}: {dl_res.text}")
                return None

            download_urls = dl_res.json().get("download_urls", {})
            out_meta = download_urls.get(out_filename)
            if not out_meta or "file_url" not in out_meta:
                logger.warning("No download file_url in Sarvam response.")
                return None

            # 7. Fetch output JSON
            async with httpx.AsyncClient(timeout=30.0) as client:
                out_content_res = await client.get(out_meta["file_url"])

            result_json = out_content_res.json()
            transcript = result_json.get("transcript", "").strip()
            total_duration = get_media_duration(audio_path)

            words, timestamps_estimated = self._parse_timestamps(
                result_json.get("timestamps"),
                result_json.get("words"),
                transcript,
                0.0,
                total_duration,
                self._detect_speech_regions(audio_path, total_duration),
            )
            words, timing_quality = await self._hybrid_word_timings(
                audio_path, language_code, words, timestamps_estimated,
            )

            segments = [
                Segment(start=0.0, end=total_duration, text=transcript, words=words)
            ]

            return TranscriptionResult(
                text=transcript,
                words=words,
                segments=segments,
                language=language_code,
                provider=self.name,
                route_used="Sarvam (Batch API)",
                timestamps_estimated=timestamps_estimated,
                timing_quality=timing_quality,
            )

        except Exception as e:
            logger.warning(f"Sarvam batch API encountered exception: {e}", exc_info=True)
            return None

    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        style: Optional[str] = "roman",
    ) -> TranscriptionResult:
        if not self.is_configured():
            raise ValueError("Sarvam API key is not configured in settings/environment.")

        # Ensure audio is an audio format (not a raw mp4/mov video)
        clean_audio = audio_path
        temp_extracted = None
        ext = os.path.splitext(audio_path)[1].lower()
        if ext in [".mp4", ".mov", ".mkv", ".avi", ".webm", ".flv"]:
            clean_audio = extract_audio(audio_path)
            temp_extracted = clean_audio

        try:
            language_code = self._get_language_code(language)
            mode = self._get_mode(language, style)
            duration = get_media_duration(clean_audio)

            logger.info(
                f"Transcribing with Sarvam: file={clean_audio}, duration={duration:.2f}s, "
                f"lang={language_code}, mode={mode}"
            )

            # For files over 30s: Use Batch API first, fall back to chunked REST <= 28s
            if duration > 30.0:
                logger.info("Attempting Sarvam Batch API route...")
                batch_result = await self._transcribe_batch_api(clean_audio, language_code, mode)
                if batch_result:
                    return batch_result

                logger.info("Sarvam Batch API unavailable or failed. Falling back to Sarvam Chunked REST route...")
                # Use silence‑based chunking (target 5‑10 s per chunk)
                chunks = self._chunk_by_silence(clean_audio, min_chunk=5.0, max_chunk=10.0)
                all_text_parts = []
                all_words: List[WordTimestamp] = []
                all_segments: List[Segment] = []
                any_estimated = False
                timing_quality = "aligned"

                for chunk_file, offset in chunks:
                    try:
                        txt, words, segments, est, chunk_quality = await self._transcribe_sync_chunk(
                            chunk_file, offset, language_code, mode
                        )
                        # Clean up transcription text and words
                        txt, words = self._postprocess_transcript(txt, words)
                        if txt:
                            all_text_parts.append(txt)
                        all_words.extend(words)
                        all_segments.extend(segments)
                        if est:
                            any_estimated = True
                        if chunk_quality != "aligned":
                            timing_quality = "estimated"
                    finally:
                        if chunk_file != clean_audio:
                            try:
                                os.remove(chunk_file)
                            except OSError:
                                logger.warning("Could not remove temporary transcription chunk")
                return TranscriptionResult(
                    text=" ".join(all_text_parts),
                    words=all_words,
                    segments=all_segments,
                    language=language_code,
                    provider=self.name,
                    route_used="Sarvam (Chunked REST)",
                    timestamps_estimated=any_estimated,
                    timing_quality=timing_quality,
                )
            else:
                txt, words, segments, est, timing_quality = await self._transcribe_sync_chunk(
                    clean_audio, 0.0, language_code, mode
                )
                txt, words = self._postprocess_transcript(txt, words)
                # Log overall first/last word if this is the sole chunk
                if words:
                    logger.info(f"Overall first word: '{words[0].text}' @ {words[0].start}s, last word: '{words[-1].text}' @ {words[-1].end}s")
                return TranscriptionResult(
                    text=txt,
                    words=words,
                    segments=segments,
                    language=language_code,
                    provider=self.name,
                    route_used="Sarvam (Synchronous REST)",
                    timestamps_estimated=est,
                    timing_quality=timing_quality,
                )
        finally:
            if temp_extracted and os.path.exists(temp_extracted) and temp_extracted != audio_path:
                try:
                    os.remove(temp_extracted)
                except Exception:
                    pass
