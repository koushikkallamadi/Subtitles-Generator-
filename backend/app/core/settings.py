from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, validator
from pathlib import Path

INITIAL_USER_CREDITS = 20.0

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, env_ignore_empty=True, extra="ignore")
    # Core
    SECRET_KEY: str = Field(default="dev-secret-key", env="SECRET_KEY")
    GOOGLE_CLIENT_ID: str = Field(default="", env="GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str = Field(default="", env="GOOGLE_CLIENT_SECRET")
    FRONTEND_URL: str = Field(default="http://localhost:3000", env="FRONTEND_URL")
    BACKEND_URL: str = Field(default="http://localhost:8000", env="BACKEND_URL")
    ALLOWED_ORIGINS: str = Field(default="http://localhost:5173,http://localhost:3000", env="ALLOWED_ORIGINS")
    PORT: int = Field(default=8000, env="PORT")
    DATABASE_PATH: str | None = Field(default=None, env="DATABASE_PATH")
    DATABASE_URL: str | None = Field(default=None, env="DATABASE_URL")
    UPLOAD_DIR: str = Field(default="./data/uploads", env="UPLOAD_DIR")
    EXPORT_DIR: str = Field(default="./data/exports", env="EXPORT_DIR")
    TEMP_DIR: str = Field(default="./data/tmp", env="TEMP_DIR")
    FONT_DIR: str = Field(default="./fonts", env="FONT_DIR")
    MAX_UPLOAD_MB: int = Field(default=100, env="MAX_UPLOAD_MB")
    MAX_VIDEO_SECONDS: int = Field(default=240, env="MAX_VIDEO_SECONDS")
    EXPORT_MAX_HEIGHT: int = Field(default=0, env="EXPORT_MAX_HEIGHT")
    EXPORT_PRESET: str = Field(default="veryfast", env="EXPORT_PRESET")
    EXPORT_CRF: int = Field(default=18, env="EXPORT_CRF")
    MEDIA_RETENTION_DAYS: int = Field(default=7, env="MEDIA_RETENTION_DAYS")
    FFMPEG_PATH: str = Field(default="ffmpeg", env="FFMPEG_PATH")
    FFPROBE_PATH: str = Field(default="ffprobe", env="FFPROBE_PATH")
    # Accept existing FREE_INITIAL_CREDITS environment values for compatibility.
    # New accounts use INITIAL_USER_CREDITS so the grant remains fixed at 20.
    FREE_INITIAL_CREDITS: float = Field(default=20.0, env="FREE_INITIAL_CREDITS")

    # Transcription
    TRANSCRIPTION_PROVIDER: str = Field(default="sarvam", env="TRANSCRIPTION_PROVIDER")
    SARVAM_API_KEY: str = Field(default="", env="SARVAM_API_KEY")
    SARVAM_API_BASE_URL: str = Field(default="https://api.sarvam.ai", env="SARVAM_API_BASE_URL")
    GROQ_API_KEY: str = Field(default="", env="GROQ_API_KEY")
    GROQ_API_BASE_URL: str = Field(default="https://api.groq.com/openai/v1", env="GROQ_API_BASE_URL")
    OPENAI_API_KEY: str = Field(default="", env="OPENAI_API_KEY")
    OPENAI_API_BASE_URL: str = Field(default="https://api.openai.com/v1", env="OPENAI_API_BASE_URL")

    # Translation
    TRANSLATION_PROVIDER: str = Field(default="gemini", env="TRANSLATION_PROVIDER")
    GEMINI_API_KEY: str = Field(default="", env="GEMINI_API_KEY")
    GOOGLE_TOKEN_URL: str = Field(default="https://oauth2.googleapis.com/token", env="GOOGLE_TOKEN_URL")
    GOOGLE_AUTH_URL: str = Field(default="https://accounts.google.com/o/oauth2/v2/auth", env="GOOGLE_AUTH_URL")

    # Text / Romanization
    TEXT_PROVIDER: str = Field(default="groq", env="TEXT_PROVIDER")
    ROMANIZATION_MODEL: str = Field(default="qwen/qwen3.8-27b", env="ROMANIZATION_MODEL")

    # Credits
    FREE_MAX_SECONDS: int = Field(default=240, env="FREE_MAX_SECONDS")
    CREDIT_COST_PER_MINUTE: float = Field(default=1.0, env="CREDIT_COST_PER_MINUTE")
    TRANSLATION_COST_PER_MINUTE: float = Field(default=0.5, env="TRANSLATION_COST_PER_MINUTE")
    TIMING_STRATEGY: str = Field(default="hybrid", env="TIMING_STRATEGY")

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

    @validator("TIMING_STRATEGY")
    def validate_timing_strategy(cls, value):
        normalized = value.lower().strip()
        if normalized not in {"hybrid", "estimate", "forced"}:
            raise ValueError("TIMING_STRATEGY must be 'hybrid', 'estimate', or 'forced'")
        return normalized

settings = Settings()
