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
            elapsed = time.time() - start_time
            cues = cues_from_transcription(res)

            print(f"  Status   : SUCCESS in {elapsed:.2f}s")
            print(f"  Text     : {res.text}")
            print(f"  Words    : {len(res.words)} words detected")
            print(f"  Cues     : {len(cues)} subtitle cues generated")
            print(f"  Timings (first 5 words):")
            for w in res.words[:5]:
                print(f"    [{w.start:.2f}s -> {w.end:.2f}s] {w.text}")

            results.append({
                "name": provider.name,
                "label": label,
                "status": "SUCCESS",
                "elapsed": elapsed,
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
            print(f"[{r['name'].upper()}] - Time: {r['elapsed']:.2f}s | Words: {r['word_count']} | Cues: {r['cue_count']}")
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
