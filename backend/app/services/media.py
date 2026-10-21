import os
import subprocess
import shutil
import tempfile
import json
import logging
from typing import List, Tuple
from app.core.settings import settings

logger = logging.getLogger(__name__)

def get_ffmpeg_cmd() -> str:
    return shutil.which(settings.FFMPEG_PATH) or settings.FFMPEG_PATH

def get_ffprobe_cmd() -> str:
    return shutil.which("ffprobe") or "ffprobe"

def get_media_duration(file_path: str) -> float:
    """Get media duration in seconds using ffprobe or ffmpeg fallback."""
    ffprobe = get_ffprobe_cmd()
    try:
        cmd = [
            ffprobe,
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            file_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return float(result.stdout.strip())
    except Exception as e:
        logger.warning(f"ffprobe failed ({e}), trying ffmpeg fallback for duration...")

    # Fallback using ffmpeg -i
    try:
        ffmpeg = get_ffmpeg_cmd()
        cmd = [ffmpeg, "-i", file_path]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        # Parse Duration: 00:00:14.15
        import re
        match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", result.stderr)
        if match:
            hours, mins, secs = match.groups()
            return int(hours) * 3600 + int(mins) * 60 + float(secs)
    except Exception as e2:
        logger.error(f"Failed to get duration: {e2}")

    return 0.0

def extract_audio(input_media_path: str, output_path: str = None) -> str:
    """
    Extract audio from video file to 16kHz mono MP3 or WAV.
    Returns the path to the extracted audio file.
    """
    if not output_path:
        fd, output_path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)

    ffmpeg = get_ffmpeg_cmd()
    cmd = [
        ffmpeg,
        "-y",
        "-i", input_media_path,
        "-vn",
        "-acodec", "libmp3lame",
        "-ar", "16000",
        "-ac", "1",
        "-b:a", "64k",
        output_path
    ]
    logger.info(f"Extracting audio from {input_media_path} to {output_path}...")
    try:
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return output_path
    except Exception as e:
        logger.warning(
            f"ffmpeg audio extraction failed ({e}). Falling back to passing input media directly ({input_media_path})."
        )
        return input_media_path

def chunk_audio(audio_path: str, chunk_duration_sec: float = 28.0) -> List[Tuple[str, float]]:
    """
    Split audio into chunks of <= chunk_duration_sec for APIs with size/duration limits.
    Returns a list of (chunk_file_path, offset_in_seconds).
    """
    total_duration = get_media_duration(audio_path)
    if total_duration <= chunk_duration_sec:
        return [(audio_path, 0.0)]

    chunks = []
    ffmpeg = get_ffmpeg_cmd()
    current_offset = 0.0
    chunk_idx = 0

    while current_offset < total_duration:
        chunk_file = os.path.join(
            tempfile.gettempdir(),
            f"chunk_{os.path.basename(audio_path)}_{chunk_idx}.mp3"
        )
        cmd = [
            ffmpeg,
            "-y",
            "-ss", str(current_offset),
            "-t", str(chunk_duration_sec),
            "-i", audio_path,
            "-acodec", "copy",
            chunk_file
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        chunks.append((chunk_file, current_offset))
        current_offset += chunk_duration_sec
        chunk_idx += 1

    return chunks
