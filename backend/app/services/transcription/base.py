from abc import ABC, abstractmethod
from typing import List, Optional
from pydantic import BaseModel, Field

class WordTimestamp(BaseModel):
    text: str
    start: float
    end: float
    confidence: Optional[float] = None

class Segment(BaseModel):
    start: float
    end: float
    text: str
    words: List[WordTimestamp] = Field(default_factory=list)

class TranscriptionResult(BaseModel):
    text: str
    words: List[WordTimestamp] = Field(default_factory=list)
    segments: List[Segment] = Field(default_factory=list)
    language: Optional[str] = None
    provider: str
    fallback_occurred: bool = False
    fallback_message: Optional[str] = None
    route_used: Optional[str] = None
    timestamps_estimated: bool = False

class BaseTranscriptionProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the provider (e.g. 'sarvam', 'groq', 'local')."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True if this provider has required API keys / runtime configured."""
        pass

    @abstractmethod
    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        style: Optional[str] = "roman",
    ) -> TranscriptionResult:
        """
        Transcribe the audio file.
        :param audio_path: Path to local audio file (wav/mp3)
        :param language: Language name or code (e.g. 'Hindi', 'hi', 'Telugu', 'en')
        :param style: Subtitle style ('roman' or 'native')
        :return: TranscriptionResult containing word timestamps and segments
        """
        pass
