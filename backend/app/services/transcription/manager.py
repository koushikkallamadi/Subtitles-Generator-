import logging
from typing import Dict, List, Optional
from app.core.settings import settings
from app.services.transcription.base import (
    BaseTranscriptionProvider,
    TranscriptionResult,
)
from app.services.transcription.sarvam import SarvamProvider
from app.services.transcription.groq import GroqProvider
from app.services.transcription.local_whisper import LocalProvider
from app.services.transcription.romanizer import apply_romanization_if_needed

logger = logging.getLogger(__name__)

class TranscriptionManager:
    def __init__(self):
        self.providers: Dict[str, BaseTranscriptionProvider] = {
            "sarvam": SarvamProvider(),
            "groq": GroqProvider(),
            "local": LocalProvider(),
        }

    def get_provider(self, name: str) -> Optional[BaseTranscriptionProvider]:
        return self.providers.get(name.lower().strip())

    def get_fallback_order(self, primary_name: str) -> List[str]:
        """Order of providers to try if primary fails."""
        primary = primary_name.lower().strip()
        all_names = ["groq", "sarvam", "local"]
        if primary in all_names:
            order = [primary] + [p for p in all_names if p != primary]
        else:
            order = all_names
        return order

    async def transcribe_with_fallback(
        self,
        audio_path: str,
        language: Optional[str] = None,
        style: Optional[str] = "roman",
        requested_provider: Optional[str] = None,
    ) -> TranscriptionResult:
        primary_name = (
            requested_provider or settings.TRANSCRIPTION_PROVIDER or "groq"
        ).lower().strip()

        fallback_chain = self.get_fallback_order(primary_name)
        errors = []

        for idx, provider_name in enumerate(fallback_chain):
            provider = self.get_provider(provider_name)
            if not provider:
                continue

            # Check configuration
            if not provider.is_configured():
                logger.info(
                    f"Provider '{provider_name}' is not configured (missing key/model), skipping..."
                )
                errors.append(f"{provider_name}: Not configured")
                continue

            try:
                logger.info(f"Attempting transcription with provider: '{provider_name}'...")
                result = await provider.transcribe(
                    audio_path=audio_path,
                    language=language,
                    style=style,
                )

                if idx > 0:
                    # A fallback occurred!
                    failed_names = ", ".join(fallback_chain[:idx])
                    friendly_msg = (
                        f"{failed_names.title()} was unavailable or rate limited. "
                        f"Automatically generated with {provider_name.title()}."
                    )
                    result.fallback_occurred = True
                    result.fallback_message = friendly_msg
                    logger.warning(f"Fallback active: {friendly_msg}")

                return result

            except Exception as e:
                err_msg = str(e)
                logger.warning(
                    f"Provider '{provider_name}' failed with error: {err_msg}. "
                    "Proceeding to next fallback provider."
                )
                errors.append(f"{provider_name}: {err_msg}")

        # If all providers failed, construct a safe non-crashing empty result
        logger.error(f"All transcription providers failed. Errors: {errors}")
        return TranscriptionResult(
            text="",
            words=[],
            segments=[],
            language=language,
            provider="none",
            fallback_occurred=True,
            fallback_message="Transcription could not be completed. Please check your audio or API keys.",
        )

transcription_manager = TranscriptionManager()
