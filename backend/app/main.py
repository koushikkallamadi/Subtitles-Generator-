import subprocess
import shutil
import uvicorn
import asyncio
import time
from pathlib import Path
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
    allow_origins=[origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()],
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
    for directory in (settings.UPLOAD_DIR, settings.EXPORT_DIR, settings.TEMP_DIR):
        Path(directory).mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    if "user_id" not in {column["name"] for column in inspect(engine).get_columns("projects")}:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE projects ADD COLUMN user_id VARCHAR(36) NULL"))
    if "timing_quality" not in {column["name"] for column in inspect(engine).get_columns("cues")}:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE cues ADD COLUMN timing_quality VARCHAR(16) NOT NULL DEFAULT 'estimated'"))
    cleanup_expired_media()
    cleanup_old_files()
    ffmpeg_path = shutil.which(settings.FFMPEG_PATH) or settings.FFMPEG_PATH
    try:
        subprocess.run([ffmpeg_path, "-version"], capture_output=True, check=True)
    except Exception:
        install_cmd = "winget install -e --id Gyan.FFmpeg" if shutil.which("winget") else "choco install ffmpeg"
        print("\nffmpeg not found. Install it with:\n" + install_cmd + "\n")
    check_subtitles_filter()
    start_font_warmup()
    app.state.cleanup_task = asyncio.create_task(_periodic_cleanup())


def cleanup_old_files():
    cutoff = time.time() - 3600
    for folder_setting in (settings.TEMP_DIR, settings.EXPORT_DIR):
        root = Path(folder_setting)
        if not root.exists():
            continue
        for path in root.rglob("*"):
            try:
                if path.is_file() and path.stat().st_mtime < cutoff:
                    path.unlink(missing_ok=True)
            except OSError:
                pass


async def _periodic_cleanup():
    while True:
        await asyncio.sleep(1800)
        cleanup_old_files()


@app.on_event("shutdown")
async def stop_cleanup():
    task = getattr(app.state, "cleanup_task", None)
    if task:
        task.cancel()

@app.get("/health")
async def health():
    return JSONResponse(content={"status": "ok"})

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=False)
