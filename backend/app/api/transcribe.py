import os
import tempfile
import logging
import asyncio
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse

from app.services.jobs import job_store, JobState
from app.services.media import extract_audio
from app.services.transcription.manager import transcription_manager
from app.services.segmentation import cues_from_transcription

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["transcription"])

async def process_transcription_job(
    job_id: str,
    temp_input_path: str,
    language: Optional[str],
    style: Optional[str],
    provider: Optional[str],
):
    temp_audio_path = None
    try:
        job_store.update(job_id, status="processing", progress=15)
        logger.info(f"Job {job_id}: Extracting audio from {temp_input_path}...")

        # Extract audio using ffmpeg
        loop = asyncio.get_event_loop()
        temp_audio_path = await loop.run_in_executor(
            None, extract_audio, temp_input_path
        )
        job_store.update(job_id, progress=35)

        # Transcribe with fallback
        logger.info(
            f"Job {job_id}: Transcribing audio (lang={language}, style={style}, provider={provider})..."
        )
        result = await transcription_manager.transcribe_with_fallback(
            audio_path=temp_audio_path,
            language=language,
            style=style,
            requested_provider=provider,
        )
        job_store.update(job_id, progress=75)

        # Segment words into subtitle cues
        logger.info(f"Job {job_id}: Generating subtitle cues...")
        cues = cues_from_transcription(result)
        job_store.update(job_id, progress=95)

        # Mark completed
        job_store.update(
            job_id,
            status="completed",
            progress=100,
            cues=cues,
            text=result.text,
            words=[w.model_dump() for w in result.words],
            provider_used=result.provider,
            fallback_occurred=result.fallback_occurred,
            fallback_message=result.fallback_message,
        )
        logger.info(
            f"Job {job_id} successfully completed with provider '{result.provider}'. "
            f"Generated {len(cues)} cues."
        )

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}", exc_info=True)
        job_store.update(
            job_id,
            status="failed",
            error=str(e),
            fallback_occurred=True,
            fallback_message=f"Transcription failed: {e}",
        )
    finally:
        # Cleanup temporary files
        if temp_input_path and os.path.exists(temp_input_path):
            try:
                os.remove(temp_input_path)
            except Exception:
                pass
        if temp_audio_path and temp_audio_path != temp_input_path and os.path.exists(temp_audio_path):
            try:
                os.remove(temp_audio_path)
            except Exception:
                pass

@router.post("/transcribe")
async def start_transcription(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    style: Optional[str] = Form("roman"),
    provider: Optional[str] = Form(None),
):
    suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_input_path = temp_file.name

    job = job_store.create()
    background_tasks.add_task(
        process_transcription_job,
        job.id,
        temp_input_path,
        language,
        style,
        provider,
    )

    return {"job_id": job.id, "status": "queued"}

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.model_dump()
