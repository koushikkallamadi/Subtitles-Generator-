import os
import json
import logging
import asyncio
import httpx
from typing import List, Optional
from app.core.settings import settings
from app.services.transcription.base import (
    BaseTranscriptionProvider,
    TranscriptionResult,
    WordTimestamp,
    Segment,
)
from app.services.media import get_media_duration, chunk_audio

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
        if (style or "roman").lower() == "roman":
            return "codemix"
        return "transcribe"

    def _estimate_word_timings(self, text: str, start: float, end: float) -> List[WordTimestamp]:
        words = [w for w in text.strip().split() if w]
        if not words:
            return []
        duration = max(0.1, end - start)
        total_chars = sum(max(1, len(w)) for w in words)
        current_time = start
        word_list: List[WordTimestamp] = []
        for w in words:
            w_dur = (max(1, len(w)) / total_chars) * duration
            w_start = current_time
            w_end = min(end, current_time + w_dur)
            word_list.append(
                WordTimestamp(text=w, start=round(w_start, 3), end=round(w_end, 3))
            )
            current_time = w_end
        return word_list

    async def _transcribe_sync_chunk(
        self,
        chunk_path: str,
        time_offset: float,
        language_code: str,
        mode: str,
    ) -> tuple[str, List[WordTimestamp], List[Segment]]:
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
            # Fallback model trial if saaras:v4 is unavailable
            if "model" in response.text.lower():
                data["model"] = "saaras:v3"
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(url, headers=headers, data=data, files=files)

        if response.status_code != 200:
            raise RuntimeError(f"Sarvam API error ({response.status_code}): {response.text}")

        res_data = response.json()
        transcript = res_data.get("transcript", "").strip()

        chunk_words: List[WordTimestamp] = []
        chunk_segments: List[Segment] = []

        # Check for word-level timestamps in response
        raw_words = res_data.get("words") or res_data.get("timestamps") or []
        chunk_duration = get_media_duration(chunk_path) or 10.0

        if raw_words and isinstance(raw_words, list) and isinstance(raw_words[0], dict):
            for item in raw_words:
                w_text = item.get("word") or item.get("text", "")
                w_start = float(item.get("start_time", item.get("start", 0.0))) + time_offset
                w_end = float(item.get("end_time", item.get("end", w_start + 0.3))) + time_offset
                if w_text.strip():
                    chunk_words.append(
                        WordTimestamp(text=w_text.strip(), start=round(w_start, 3), end=round(w_end, 3))
                    )
        else:
            # Estimate word timings by spreading across segment duration
            logger.info(
                f"[FLAG] Sarvam response for chunk at {time_offset:.2f}s had no word-level timestamps. "
                "Estimating word timings across chunk duration."
            )
            chunk_words = self._estimate_word_timings(
                transcript, time_offset, time_offset + chunk_duration
            )

        seg_start = time_offset
        seg_end = time_offset + chunk_duration
        chunk_segments.append(
            Segment(start=seg_start, end=seg_end, text=transcript, words=chunk_words)
        )

        return transcript, chunk_words, chunk_segments

    async def _transcribe_batch_api(
        self,
        audio_path: str,
        language_code: str,
        mode: str,
    ) -> Optional[TranscriptionResult]:
        """Attempt Sarvam Batch API job creation and polling."""
        url = "https://api.sarvam.ai/speech-to-text/job/v1"
        headers = {
            "api-subscription-key": settings.SARVAM_API_KEY.strip(),
        }

        try:
            with open(audio_path, "rb") as f:
                file_bytes = f.read()

            filename = os.path.basename(audio_path)
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
                res = await client.post(url, headers=headers, data=data, files=files)

            if res.status_code not in (200, 201, 202):
                logger.warning(f"Sarvam batch job submission returned {res.status_code}: {res.text}")
                return None

            job_info = res.json()
            job_id = job_info.get("job_id") or job_info.get("id")
            if not job_id:
                return None

            # Poll for completion (up to 90s)
            poll_url = f"{url}/{job_id}"
            for _ in range(30):
                await asyncio.sleep(3)
                async with httpx.AsyncClient(timeout=30.0) as client:
                    poll_res = await client.get(poll_url, headers=headers)
                if poll_res.status_code == 200:
                    poll_data = poll_res.json()
                    status = (poll_data.get("status") or "").lower()
                    if status in ("completed", "done", "success"):
                        # Process results
                        result_data = poll_data.get("result") or poll_data
                        transcript = result_data.get("transcript", "")
                        words: List[WordTimestamp] = []
                        if "words" in result_data:
                            for w in result_data["words"]:
                                words.append(
                                    WordTimestamp(
                                        text=w.get("word") or w.get("text", ""),
                                        start=float(w.get("start", 0)),
                                        end=float(w.get("end", 0)),
                                    )
                                )
                        else:
                            total_dur = get_media_duration(audio_path)
                            words = self._estimate_word_timings(transcript, 0.0, total_dur)
                        return TranscriptionResult(
                            text=transcript,
                            words=words,
                            language=language_code,
                            provider=self.name,
                        )
                    elif status in ("failed", "error"):
                        logger.error(f"Sarvam batch job failed: {poll_data}")
                        return None
        except Exception as e:
            logger.warning(f"Sarvam batch API encountered exception: {e}")

        return None

    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        style: Optional[str] = "roman",
    ) -> TranscriptionResult:
        if not self.is_configured():
            raise ValueError("Sarvam API key is not configured in settings/environment.")

        language_code = self._get_language_code(language)
        mode = self._get_mode(language, style)
        duration = get_media_duration(audio_path)

        logger.info(
            f"Transcribing with Sarvam: file={audio_path}, duration={duration:.2f}s, "
            f"lang={language_code}, mode={mode}"
        )

        # For files over 30s: Use Batch API if available, else chunking <= 28s
        if duration > 30.0:
            batch_result = await self._transcribe_batch_api(audio_path, language_code, mode)
            if batch_result:
                return batch_result

            logger.info("Proceeding with audio chunking for Sarvam synchronous transcription...")
            chunks = chunk_audio(audio_path, chunk_duration_sec=28.0)
            all_text_parts = []
            all_words: List[WordTimestamp] = []
            all_segments: List[Segment] = []

            for chunk_file, offset in chunks:
                txt, words, segments = await self._transcribe_sync_chunk(
                    chunk_file, offset, language_code, mode
                )
                if txt:
                    all_text_parts.append(txt)
                all_words.extend(words)
                all_segments.extend(segments)

            return TranscriptionResult(
                text=" ".join(all_text_parts),
                words=all_words,
                segments=all_segments,
                language=language_code,
                provider=self.name,
            )
        else:
            txt, words, segments = await self._transcribe_sync_chunk(
                audio_path, 0.0, language_code, mode
            )
            return TranscriptionResult(
                text=txt,
                words=words,
                segments=segments,
                language=language_code,
                provider=self.name,
            )
