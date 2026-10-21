import os
from pydantic_settings import BaseSettings
from pydantic import Field, validator

class Settings(BaseSettings):
    # Core
    SECRET_KEY: str = Field(default="dev-secret-key", env="SECRET_KEY")
    DATABASE_URL: str = Field(default="sqlite:///./captionkit.db", env="DATABASE_URL")
    FFMPEG_PATH: str = Field(default="ffmpeg", env="FFMPEG_PATH")

    # Transcription
    TRANSCRIPTION_PROVIDER: str = Field(default="sarvam", env="TRANSCRIPTION_PROVIDER")
    SARVAM_API_KEY: str = Field(default="", env="SARVAM_API_KEY")
    GROQ_API_KEY: str = Field(default="", env="GROQ_API_KEY")
    OPENAI_API_KEY: str = Field(default="", env="OPENAI_API_KEY")

    # Translation
    TRANSLATION_PROVIDER: str = Field(default="gemini", env="TRANSLATION_PROVIDER")
    GEMINI_API_KEY: str = Field(default="", env="GEMINI_API_KEY")

    # Text / Romanization
    TEXT_PROVIDER: str = Field(default="groq", env="TEXT_PROVIDER")
    ROMANIZATION_MODEL: str = Field(default="qwen/qwen3.8-27b", env="ROMANIZATION_MODEL")

    # Credits
    FREE_MAX_SECONDS: int = Field(default=240, env="FREE_MAX_SECONDS")
    FREE_INITIAL_CREDITS: float = Field(default=24.0, env="FREE_INITIAL_CREDITS")
    CREDIT_COST_PER_MINUTE: float = Field(default=1.0, env="CREDIT_COST_PER_MINUTE")
    TRANSLATION_COST_PER_MINUTE: float = Field(default=0.5, env="TRANSLATION_COST_PER_MINUTE")

    @validator("TRANSCRIPTION_PROVIDER")
    def validate_transcription_provider(cls, v):
        allowed = {"sarvam", "groq", "local", "openai"}
        if v.lower() not in allowed:
            raise ValueError(f"TRANSCRIPTION_PROVIDER must be one of {allowed}")
        return v.lower()

    @validator("TRANSLATION_PROVIDER")
    def validate_translation_provider(cls, v):
        if v.lower() not in {"gemini", "openai"}:
            raise ValueError("TRANSLATION_PROVIDER must be 'gemini' or 'openai'")
        return v.lower()

    @validator("SARVAM_API_KEY", pre=True)
    def fallback_sarvam_key(cls, v):
        if not v or not str(v).strip():
            if os.path.exists(".env.example"):
                from dotenv import dotenv_values
                example_vals = dotenv_values(".env.example")
                return example_vals.get("SARVAM_API_KEY", "") or ""
        return v or ""

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
