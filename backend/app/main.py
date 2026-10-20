import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from app.core.settings import settings
import subprocess
import shutil

app = FastAPI(title="CaptionKit Backend")

# Startup check for ffmpeg
@app.on_event("startup")
async def check_ffmpeg():
    ffmpeg_path = shutil.which(settings.FFMPEG_PATH) or settings.FFMPEG_PATH
    try:
        subprocess.run([ffmpeg_path, "-version"], capture_output=True, check=True)
    except Exception:
        # Choose a sensible install command (winget preferred, fallback to chocolatey)
        install_cmd = "winget install -e --id Gyan.FFmpeg" if shutil.which("winget") else "choco install ffmpeg"
        print("\nffmpeg not found. Install it with:\n" + install_cmd + "\n")

@app.get("/health")
async def health():
    return JSONResponse(content={"status": "ok"})

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
