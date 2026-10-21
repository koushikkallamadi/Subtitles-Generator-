#!/usr/bin/env python3
"""
Developer utility script to compare transcription providers (Sarvam, Groq, Local).
Runs an audio/video file through all configured providers and outputs a side-by-side comparison.

Usage:
    python backend/scripts/compare_providers.py <path_to_audio_or_video> [--language hi] [--style roman]
"""

import sys
import os
import time
import argparse
import asyncio
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import functools
print = functools.partial(print, flush=True)

# Add backend directory to sys.path so imports work seamlessly
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.settings import settings
from app.services.media import extract_audio, get_media_duration
from app.services.transcription.sarvam import SarvamProvider
from app.services.transcription.groq import GroqProvider
from app.services.transcription.local_whisper import LocalProvider
from app.services.transcription.romanizer import apply_romanization_if_needed
from app.services.segmentation import cues_from_transcription

async def run_comparison(media_path: str, language: str = "hi", style: str = "roman"):
    if not os.path.exists(media_path):
        print(f"\n[ERROR] File not found: {media_path}\n")
        sys.exit(1)

    print("=" * 80)
    print(f" CAPTIONKIT TRANSCRIPTION PROVIDER COMPARISON")
    print("=" * 80)
    print(f" Input File : {media_path}")
    print(f" Language   : {language}")
    print(f" Style      : {style}")

    # Extract audio if video
    ext = os.path.splitext(media_path)[1].lower()
    temp_audio = None
    if ext in [".mp4", ".mov", ".mkv", ".webm", ".avi"]:
        print(f" Extracting audio using FFmpeg...")
        audio_path = extract_audio(media_path)
        temp_audio = audio_path
    else:
        audio_path = media_path

    duration = get_media_duration(audio_path)
    print(f" Duration   : {duration:.2f} seconds")
    print("=" * 80)

    providers = [
        ("Sarvam (Saaras/Saarika)", SarvamProvider()),
        ("Groq (Whisper-large-v3)", GroqProvider()),
        ("Local (faster-whisper)", LocalProvider()),
    ]

    results = []

    for label, provider in providers:
        print(f"\n--- Testing [{provider.name.upper()}] - {label} ---")
        if not provider.is_configured():
            print(f"  Status : SKIPPED (Not configured. Missing API key or package)")
            results.append({
                "name": provider.name,
                "label": label,
                "status": "SKIPPED",
                "error": "Not configured",
            })
            continue

        start_time = time.time()
        try:
            print(f"  Running transcription (style={style}, lang={language})...")
            res = await provider.transcribe(
                audio_path=audio_path,
                language=language,
                style=style,
            )
            res = await apply_romanization_if_needed(res, style=style, language=language)
            elapsed = time.time() - start_time
            cues = cues_from_transcription(res)

            route_str = f" ({res.route_used})" if getattr(res, "route_used", None) else ""
            ts_type = "ESTIMATED (spread across chunk/audio)" if getattr(res, "timestamps_estimated", False) else "REAL (word-level from provider)"
            print(f"  Status     : SUCCESS{route_str} in {elapsed:.2f}s")
            print(f"  Timestamps : {ts_type}")
            print(f"  Text       : {res.text}")
            print(f"  Words      : {len(res.words)} words detected")
            print(f"  Cues       : {len(cues)} subtitle cues generated")
            print(f"  Timings (first 5 words):")
            for w in res.words[:5]:
                print(f"    [{w.start:.2f}s -> {w.end:.2f}s] {w.text}")

            results.append({
                "name": provider.name,
                "label": label,
                "status": "SUCCESS",
                "elapsed": elapsed,
                "route_used": getattr(res, "route_used", None),
                "timestamps_type": ts_type,
                "text": res.text,
                "word_count": len(res.words),
                "cue_count": len(cues),
                "words": res.words,
                "cues": cues,
            })

        except Exception as e:
            elapsed = time.time() - start_time
            print(f"  Status : FAILED in {elapsed:.2f}s")
            print(f"  Error  : {e}")
            results.append({
                "name": provider.name,
                "label": label,
                "status": "FAILED",
                "elapsed": elapsed,
                "error": str(e),
            })

    # Summary
    print("\n" + "=" * 80)
    print(" SUMMARY COMPARISON")
    print("=" * 80)
    for r in results:
        status = r["status"]
        if status == "SUCCESS":
            route_info = f" ({r.get('route_used')})" if r.get('route_used') else ""
            print(f"[{r['name'].upper()}{route_info}] - Time: {r['elapsed']:.2f}s | Words: {r['word_count']} | Cues: {r['cue_count']}")
            print(f"  Timestamps: {r.get('timestamps_type', 'N/A')}")
            print(f"  Text: {r['text'][:120]}..." if len(r['text']) > 120 else f"  Text: {r['text']}")
        else:
            print(f"[{r['name'].upper()}] - {status}: {r.get('error', '')}")
    print("=" * 80 + "\n")

    if temp_audio and os.path.exists(temp_audio):
        try:
            os.remove(temp_audio)
        except Exception:
            pass

def main():
    parser = argparse.ArgumentParser(description="Compare CaptionKit transcription providers.")
    parser.add_argument("file", help="Path to input audio or video file")
    parser.add_argument("--language", default="hi", help="Language code or name (e.g. hi, te, en)")
    parser.add_argument("--style", default="roman", choices=["roman", "native"], help="Subtitle style (roman/native)")

    args = parser.parse_args()
    asyncio.run(run_comparison(args.file, language=args.language, style=args.style))

if __name__ == "__main__":
    main()
