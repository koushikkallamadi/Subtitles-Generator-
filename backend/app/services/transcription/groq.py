import os
import json
import logging
import httpx
from typing import List, Optional
from app.core.settings import settings
from app.services.transcription.base import (
    BaseTranscriptionProvider,
    TranscriptionResult,
    WordTimestamp,
    Segment,
)

logger = logging.getLogger(__name__)

GROQ_LANGUAGE_MAP = {
    "hindi": "hi",
    "hi": "hi",
    "english": "en",
    "en": "en",
    "urdu": "ur",
    "ur": "ur",
    "tamil": "ta",
    "ta": "ta",
    "marathi": "mr",
    "mr": "mr",
    "telugu": "te",
    "te": "te",
    "kannada": "kn",
    "kn": "kn",
    "malayalam": "ml",
    "ml": "ml",
    "bengali": "bn",
    "bn": "bn",
    "gujarati": "gu",
    "gu": "gu",
    "punjabi": "pa",
    "pa": "pa",
    "odia": "or",
    "or": "or",
}

class GroqProvider(BaseTranscriptionProvider):
    @property
    def name(self) -> str:
        return "groq"

    def is_configured(self) -> bool:
        return bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip())

    def _get_language_code(self, language: Optional[str]) -> Optional[str]:
        if not language:
            return None
        lang_clean = language.lower().strip()
        if lang_clean in ("auto-detect", "auto", "unknown"):
            return None
        return GROQ_LANGUAGE_MAP.get(lang_clean, None)

    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        style: Optional[str] = "roman",
    ) -> TranscriptionResult:
        if not self.is_configured():
            raise ValueError("GROQ_API_KEY is not configured in settings/environment.")

        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY.strip()}",
        }

        with open(audio_path, "rb") as f:
            file_bytes = f.read()

        filename = os.path.basename(audio_path)
        data = {
            "model": "whisper-large-v3",
            "response_format": "verbose_json",
            "timestamp_granularities[]": ["word", "segment"],
        }

        lang_code = self._get_language_code(language)
        if lang_code:
            data["language"] = lang_code

        ext = os.path.splitext(filename)[1].lower()
        mime_type = "video/mp4" if ext == ".mp4" else "audio/mpeg" if ext == ".mp3" else "audio/wav" if ext == ".wav" else "audio/m4a"

        files = {
            "file": (filename, file_bytes, mime_type),
        }

        logger.info(f"Transcribing with Groq Whisper: file={audio_path}, lang={lang_code}")

        timeout = httpx.Timeout(120.0, connect=30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, headers=headers, data=data, files=files)

        if response.status_code != 200:
            raise RuntimeError(f"Groq API error ({response.status_code}): {response.text}")

        res_data = response.json()
        transcript = res_data.get("text", "").strip()

        words: List[WordTimestamp] = []
        raw_words = res_data.get("words", [])
        for w in raw_words:
            w_text = w.get("word", "").strip()
            if w_text:
                words.append(
                    WordTimestamp(
                        text=w_text,
                        start=round(float(w.get("start", 0)), 3),
                        end=round(float(w.get("end", 0)), 3),
                    )
                )

        segments: List[Segment] = []
        raw_segments = res_data.get("segments", [])
        for s in raw_segments:
            s_text = s.get("text", "").strip()
            s_start = round(float(s.get("start", 0)), 3)
            s_end = round(float(s.get("end", 0)), 3)
            # Find words that belong to this segment
            s_words = [
                w for w in words if w.start >= s_start - 0.05 and w.end <= s_end + 0.05
            ]
            segments.append(Segment(start=s_start, end=s_end, text=s_text, words=s_words))

        return TranscriptionResult(
            text=transcript,
            words=words,
            segments=segments,
            language=res_data.get("language") or lang_code,
            provider=self.name,
        )
