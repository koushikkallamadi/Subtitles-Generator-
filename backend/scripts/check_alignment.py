"""Compare CaptionKit's transcription timings with Groq Whisper word timings.

Usage (from backend):
  .venv\\Scripts\\python scripts\\check_alignment.py <media> --language telugu --style roman

This intentionally prints only transcripts, anchor words, and timing diagnostics;
it never prints API keys or request headers.
""" 
from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import sys
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Iterable

import httpx
import truststore

truststore.inject_into_ssl()
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.settings import settings  # noqa: E402
from app.services.media import extract_audio, get_ffmpeg_cmd, get_ffprobe_cmd, get_media_duration  # noqa: E402
from app.services.transcription.base import Segment, TranscriptionResult, WordTimestamp  # noqa: E402
from app.services.transcription.groq import GROQ_LANGUAGE_MAP  # noqa: E402
from app.services.transcription.sarvam import SarvamProvider  # noqa: E402
from app.services.transcription.timing import merge_whisper_timings, monotonic_fuzzy_matches  # noqa: E402


def sarvam_current_pipeline(path: str, language: str, style: str) -> TranscriptionResult:
    """Use the same Saaras v4 route and timestamp parser as the app."""
    provider = SarvamProvider()
    language_code = provider._get_language_code(language)
    mode = provider._get_mode(language, style)
    duration = get_media_duration(path)
    api_key = settings.SARVAM_API_KEY.strip()
    headers = {"api-subscription-key": api_key, "Content-Type": "application/json"}

    if duration <= 30:
        with open(path, "rb") as audio, httpx.Client(timeout=60.0) as client:
            response = client.post("https://api.sarvam.ai/speech-to-text", headers={"api-subscription-key": api_key}, data={"model": "saaras:v4", "mode": mode, "language_code": language_code, "with_timestamps": "true"}, files={"file": (Path(path).name, audio, "audio/mpeg")})
        if response.status_code != 200:
            raise RuntimeError(f"Sarvam REST returned HTTP {response.status_code}")
        payload = response.json()
        text = str(payload.get("transcript", "")).strip()
        regions = provider._detect_speech_regions(path, duration)
        words, estimated = provider._parse_timestamps(payload.get("timestamps"), payload.get("words"), text, 0.0, duration, regions)
        text, words = provider._postprocess_transcript(text, words)
        route = "Sarvam (Synchronous REST)"
    else:
        # Mirror the production batch flow, without importing its async wrapper.
        with httpx.Client(timeout=90.0) as client:
            created = client.post("https://api.sarvam.ai/speech-to-text/job/v1", headers=headers, json={"job_parameters": {"model": "saaras:v4", "mode": mode, "with_timestamps": True, "with_diarization": False, "language_code": language_code}})
            if created.status_code not in (200, 201, 202):
                raise RuntimeError(f"Sarvam batch create returned HTTP {created.status_code}")
            job_id = created.json().get("job_id")
            filename = Path(path).name
            upload = client.post("https://api.sarvam.ai/speech-to-text/job/v1/upload-files", headers=headers, json={"job_id": job_id, "files": [filename]})
            if upload.status_code != 200:
                raise RuntimeError(f"Sarvam batch upload URL returned HTTP {upload.status_code}")
            upload_meta = upload.json().get("upload_urls", {}).get(filename, {})
            if not upload_meta.get("file_url"):
                raise RuntimeError("Sarvam batch response had no upload URL")
            with open(path, "rb") as audio:
                uploaded = client.put(upload_meta["file_url"], content=audio.read(), headers={"Content-Type": "audio/mpeg"})
            if uploaded.status_code not in (200, 201, 204):
                raise RuntimeError(f"Sarvam storage upload returned HTTP {uploaded.status_code}")
            started = client.post(f"https://api.sarvam.ai/speech-to-text/job/v1/{job_id}/start", headers=headers)
            if started.status_code != 200:
                raise RuntimeError(f"Sarvam batch start returned HTTP {started.status_code}")
            job_details = None
            for _ in range(40):
                time.sleep(3.0)
                status = client.get(f"https://api.sarvam.ai/speech-to-text/job/v1/{job_id}/status", headers={"api-subscription-key": api_key})
                if status.status_code != 200:
                    continue
                state = status.json()
                if state.get("job_state") == "Completed":
                    job_details = state.get("job_details") or []
                    break
                if state.get("job_state") in ("Failed", "error"):
                    raise RuntimeError("Sarvam batch job failed")
            if not job_details:
                raise RuntimeError("Sarvam batch job did not complete within 120 seconds")
            outputs = job_details[0].get("outputs", [])
            output_name = outputs[0].get("file_name", "0.json") if outputs else "0.json"
            download = client.post("https://api.sarvam.ai/speech-to-text/job/v1/download-files", headers=headers, json={"job_id": job_id, "files": [output_name]})
            if download.status_code != 200:
                raise RuntimeError(f"Sarvam download URL returned HTTP {download.status_code}")
            download_meta = download.json().get("download_urls", {}).get(output_name, {})
            if not download_meta.get("file_url"):
                raise RuntimeError("Sarvam batch response had no download URL")
            result = client.get(download_meta["file_url"])
            if result.status_code != 200:
                raise RuntimeError(f"Sarvam result download returned HTTP {result.status_code}")
            payload = result.json()
        text = str(payload.get("transcript", "")).strip()
        regions = provider._detect_speech_regions(path, duration)
        words, estimated = provider._parse_timestamps(payload.get("timestamps"), payload.get("words"), text, 0.0, duration, regions)
        route = "Sarvam (Batch API)"
    return TranscriptionResult(text=text, words=words, segments=[Segment(start=0.0, end=duration, text=text, words=words)], language=language_code, provider="sarvam", route_used=route, timestamps_estimated=estimated)


def groq_whisper(path: str, language: str) -> TranscriptionResult:
    language_code = GROQ_LANGUAGE_MAP.get(language.casefold().strip())
    data = {"model": "whisper-large-v3", "response_format": "verbose_json", "timestamp_granularities[]": ["word", "segment"]}
    if language_code:
        data["language"] = language_code
    with open(path, "rb") as audio, httpx.Client(timeout=httpx.Timeout(120.0, connect=30.0)) as client:
        response = client.post("https://api.groq.com/openai/v1/audio/transcriptions", headers={"Authorization": f"Bearer {settings.GROQ_API_KEY.strip()}"}, data=data, files={"file": (Path(path).name, audio, "audio/mpeg")})
    if response.status_code != 200:
        raise RuntimeError(f"Groq Whisper returned HTTP {response.status_code}")
    payload = response.json()
    words = [WordTimestamp(text=item["word"].strip(), start=float(item["start"]), end=float(item["end"])) for item in payload.get("words", []) if item.get("word", "").strip()]
    return TranscriptionResult(text=payload.get("text", ""), words=words, language=payload.get("language"), provider="groq")


def percentile(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    index = (len(ordered) - 1) * p
    low = int(index)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (index - low)


def report_matches(words: list[WordTimestamp], whisper: list[WordTimestamp], duration: float) -> None:
    matches = monotonic_fuzzy_matches(words, whisper, threshold=0.60)
    rows = []
    for our_index, reference_index, similarity in matches:
        ours, reference = words[our_index], whisper[reference_index]
        rows.append((ours.start, (ours.start - reference.start) * 1000, ours.text, reference.text, similarity))
    print("FUZZY_MONOTONIC_MATCHES (difference = pipeline start - Whisper start)")
    for timestamp, difference, ours, reference, similarity in rows:
        print(f"t={timestamp:7.3f}s ours={ours:<20.20} whisper={reference:<20.20} similarity={similarity:.2f} diff={difference:+7.1f}ms")
    if not rows:
        print("SUMMARY anchors=0; metrics unavailable")
        return
    signed = [difference for _, difference, *_ in rows]
    absolute = [abs(value) for value in signed]
    third = duration / 3
    parts = {
        "first": [difference for timestamp, difference, *_ in rows if timestamp < third],
        "middle": [difference for timestamp, difference, *_ in rows if third <= timestamp < 2 * third],
        "last": [difference for timestamp, difference, *_ in rows if timestamp >= 2 * third],
    }
    part_text = ", ".join(f"{name}={statistics.median(values):+.1f}ms(n={len(values)})" if values else f"{name}=n/a(n=0)" for name, values in parts.items())
    print(f"SUMMARY anchors={len(rows)} median_signed_error={statistics.median(signed):+.1f}ms p90_abs_error={percentile(absolute, .90):.1f}ms by_third: {part_text}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("media", type=Path)
    parser.add_argument("--language", default="telugu")
    parser.add_argument("--style", choices=("roman", "native"), default="roman")
    args = parser.parse_args()
    media = args.media.resolve()
    if not media.is_file():
        parser.error(f"media file does not exist: {media}")

    audio_path = extract_audio(str(media))
    try:
        ffprobe = get_ffprobe_cmd()
        import json
        import subprocess
        probe = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=start_time,duration:stream=index,codec_type,start_time,duration", "-of", "json", str(media)],
            capture_output=True, text=True, check=True,
        )
        metadata = json.loads(probe.stdout)
        print("FFPROBE_READY", flush=True)
        print("STREAM_TIMING")
        print(json.dumps({"format": metadata.get("format"), "streams": metadata.get("streams", [])}, indent=2))

        print("RUNNING_CURRENT_PIPELINE", flush=True)
        ours_result = sarvam_current_pipeline(str(audio_path), args.language, args.style)
        print(f"pipeline provider={ours_result.provider} route={ours_result.route_used or 'manager'} words={len(ours_result.words)}")

        print("RUNNING_GROQ_WHISPER_REFERENCE", flush=True)
        whisper_result = groq_whisper(str(audio_path), args.language)
        print(f"whisper words={len(whisper_result.words)}")

        if settings.TIMING_STRATEGY == "hybrid":
            hybrid_words, matched_ratio = merge_whisper_timings(ours_result.words, whisper_result.words)
            if matched_ratio >= 0.40:
                ours_result.words = hybrid_words
                print(f"HYBRID_APPLIED matched_words={matched_ratio * 100:.1f}%")
            else:
                print(f"HYBRID_FALLBACK matched_words={matched_ratio * 100:.1f}%")
        report_matches(ours_result.words, whisper_result.words, float(metadata.get("format", {}).get("duration", 0) or 0))
        return 0
    finally:
        if audio_path != str(media):
            Path(audio_path).unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
