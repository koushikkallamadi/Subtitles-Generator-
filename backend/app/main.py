import subprocess
import shutil
import uvicorn
from sqlalchemy import inspect, text
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.settings import settings
from app.api.transcribe import router as transcribe_router
from app.api.projects import router as projects_router, cleanup_expired_media
from app.api.auth import router as auth_router
from app.db import Base, engine
from app.services.export import check_subtitles_filter, start_font_warmup

app = FastAPI(title="CaptionKit Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(transcribe_router)
app.include_router(projects_router)
app.include_router(auth_router)

# Startup check for ffmpeg
@app.on_event("startup")
async def check_ffmpeg():
    Base.metadata.create_all(bind=engine)
    if "user_id" not in {column["name"] for column in inspect(engine).get_columns("projects")}:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE projects ADD COLUMN user_id VARCHAR(36) NULL"))
    cleanup_expired_media()
    ffmpeg_path = shutil.which(settings.FFMPEG_PATH) or settings.FFMPEG_PATH
    try:
        subprocess.run([ffmpeg_path, "-version"], capture_output=True, check=True)
    except Exception:
        install_cmd = "winget install -e --id Gyan.FFmpeg" if shutil.which("winget") else "choco install ffmpeg"
        print("\nffmpeg not found. Install it with:\n" + install_cmd + "\n")
    check_subtitles_filter()
    start_font_warmup()

@app.get("/health")
async def health():
    return JSONResponse(content={
        "status": "ok",
        "default_provider": settings.TRANSCRIPTION_PROVIDER,
        "sarvam_configured": bool(settings.SARVAM_API_KEY),
        "groq_configured": bool(settings.GROQ_API_KEY),
    })

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
