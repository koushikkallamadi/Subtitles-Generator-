import os
import asyncio
import logging
from typing import List, Optional

# Compatibility patch for PyAV 19+ metadata_errors argument
try:
    import av
    _orig_av_open = av.open
    def _safe_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _safe_av_open
except Exception:
    pass

from app.services.transcription.base import (
    BaseTranscriptionProvider,
    TranscriptionResult,
    WordTimestamp,
    Segment,
)
from app.services.transcription.groq import GROQ_LANGUAGE_MAP

logger = logging.getLogger(__name__)

_model_instance = None

def get_local_model():
    global _model_instance
    if _model_instance is None:
        try:
            from faster_whisper import WhisperModel
            model_size = os.getenv("LOCAL_WHISPER_MODEL", "tiny")
            logger.info(f"Loading faster-whisper model ('{model_size}', cpu, int8)...")
            try:
                _model_instance = WhisperModel(model_size, device="cpu", compute_type="int8")
            except Exception:
                _model_instance = WhisperModel(model_size, device="cpu", compute_type="float32")
        except Exception as e:
            logger.error(f"Failed to load faster-whisper model: {e}")
            raise
    return _model_instance

class LocalProvider(BaseTranscriptionProvider):
    @property
    def name(self) -> str:
        return "local"

    def is_configured(self) -> bool:
        try:
            import faster_whisper
            return True
        except ImportError:
            return False

    def _get_language_code(self, language: Optional[str]) -> Optional[str]:
        if not language:
            return None
        lang_clean = language.lower().strip()
        if lang_clean in ("auto-detect", "auto", "unknown"):
            return None
        return GROQ_LANGUAGE_MAP.get(lang_clean, None)

    def _run_transcription_sync(
        self,
        audio_path: str,
        lang_code: Optional[str],
    ) -> TranscriptionResult:
        model = get_local_model()
        segments_gen, info = model.transcribe(
            audio_path,
            language=lang_code,
            word_timestamps=True,
            beam_size=1, # Fast greedy search for responsive local transcription
        )

        all_words: List[WordTimestamp] = []
        all_segments: List[Segment] = []
        text_parts: List[str] = []

        for seg in segments_gen:
            seg_text = seg.text.strip()
            if seg_text:
                text_parts.append(seg_text)

            seg_words: List[WordTimestamp] = []
            if seg.words:
                for w in seg.words:
                    clean_w = w.word.strip()
                    if clean_w:
                        wt = WordTimestamp(
                            text=clean_w,
                            start=round(float(w.start), 3),
                            end=round(float(w.end), 3),
                            confidence=round(float(w.probability), 3) if hasattr(w, "probability") else None,
                        )
                        seg_words.append(wt)
                        all_words.append(wt)

            all_segments.append(
                Segment(
                    start=round(float(seg.start), 3),
                    end=round(float(seg.end), 3),
                    text=seg_text,
                    words=seg_words,
                )
            )

        return TranscriptionResult(
            text=" ".join(text_parts),
            words=all_words,
            segments=all_segments,
            language=info.language if hasattr(info, "language") else lang_code,
            provider=self.name,
        )

    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        style: Optional[str] = "roman",
    ) -> TranscriptionResult:
        if not self.is_configured():
            raise RuntimeError("faster-whisper package is not installed or available.")

        lang_code = self._get_language_code(language)
        logger.info(f"Transcribing locally with faster-whisper: {audio_path}, lang={lang_code}")

        result = await asyncio.to_thread(self._run_transcription_sync, audio_path, lang_code)
        return result
