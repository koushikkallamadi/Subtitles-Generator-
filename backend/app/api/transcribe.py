import os
import tempfile
import logging
import asyncio
import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select, update

from app.services.jobs import job_store, JobState
from app.services.media import extract_audio
from app.services.media import get_media_duration
from app.services.transcription.manager import transcription_manager
from app.services.segmentation import cues_from_transcription
from app.api.projects import project_media_path
from app.db import SessionLocal
from app.models import Cue, Project
from app.models import User
from app.api.auth import get_current_user, owned_project
from app.core.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["transcription"])


def _credit_cost(duration_seconds: float) -> float:
    billed_minutes = max(1, math.ceil(duration_seconds / 60))
    return billed_minutes * settings.CREDIT_COST_PER_MINUTE


def _deduct_credits(user_id: str, amount: float) -> None:
    with SessionLocal() as db:
        result = db.execute(
            update(User)
            .where(User.id == user_id, User.credits >= amount)
            .values(credits=User.credits - amount)
            .execution_options(synchronize_session=False)
        )
        if result.rowcount != 1:
            balance = db.scalar(select(User.credits).where(User.id == user_id)) or 0.0
            db.rollback()
            raise HTTPException(
                status_code=402,
                detail=(
                    f"This video needs {amount:g} credits, but your balance is "
                    f"{balance:g}. Billing is still being built; please wait a "
                    "little while before using more video minutes."
                ),
            )
        db.commit()


def _refund_credits(user_id: str, amount: float) -> None:
    if amount <= 0:
        return
    with SessionLocal() as db:
        db.execute(
            update(User)
            .where(User.id == user_id)
            .values(credits=User.credits + amount)
            .execution_options(synchronize_session=False)
        )
        db.commit()


def _remove_temp_file(path: str | None) -> None:
    if path and os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            logger.warning("Could not remove temporary transcription input file")

async def process_transcription_job(
    job_id: str,
    temp_input_path: str,
    language: Optional[str],
    style: Optional[str],
    provider: Optional[str],
    project_id: Optional[str] = None,
    cleanup_input: bool = True,
    reserved_credits: float = 0.0,
    user_id: Optional[str] = None,
):
    temp_audio_path = None
    transcription_started = False
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
        transcription_started = True
        result = await transcription_manager.transcribe_with_fallback(
            audio_path=temp_audio_path,
            language=language,
            style=style,
            requested_provider=provider,
        )
        if result.provider == "none" and user_id:
            _refund_credits(user_id, reserved_credits)
            reserved_credits = 0.0
        job_store.update(job_id, progress=75)

        # Segment words into subtitle cues
        logger.info(f"Job {job_id}: Generating subtitle cues...")
        cues = cues_from_transcription(result)
        if project_id:
            with SessionLocal() as db:
                project = db.get(Project, project_id)
                if project:
                    db.query(Cue).filter(Cue.project_id == project_id).delete(synchronize_session=False)
                    for idx, cue in enumerate(cues):
                        db.add(Cue(project_id=project_id, idx=idx, start=cue["start"], end=cue["end"], text=cue["text"], words_json=cue.get("words", []), linked=True, timing_quality=cue.get("timing_quality", "estimated")))
                    project.language = language or project.language
                    project.style = style or project.style
                    project.updated_at = datetime.utcnow()
                    db.commit()
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
        if not transcription_started and user_id:
            try:
                _refund_credits(user_id, reserved_credits)
            except Exception:
                logger.exception("Could not refund unused transcription credits")
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
        if cleanup_input and temp_input_path and os.path.exists(temp_input_path):
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
    file: Optional[UploadFile] = File(None),
    project_id: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    style: Optional[str] = Form("roman"),
    provider: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
):
    project_duration = 0.0
    project_source = None
    if project_id:
        with SessionLocal() as db:
            project = owned_project(db, project_id, user)
            project_duration = float(project.duration or 0.0)
            project_source = project_media_path(project_id)
    cleanup_input = True
    if file is not None:
        suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_input_path = temp_file.name
        await file.close()
        input_duration = get_media_duration(temp_input_path)
        if input_duration <= 0:
            _remove_temp_file(temp_input_path)
            raise HTTPException(status_code=422, detail="Could not read the video duration")
    elif project_id:
        if project_source is None:
            raise HTTPException(status_code=404, detail="Project media not found")
        temp_input_path = str(project_source)
        input_duration = project_duration or get_media_duration(temp_input_path)
        if input_duration <= 0:
            raise HTTPException(status_code=422, detail="Could not read the video duration")
        cleanup_input = False
    else:
        raise HTTPException(status_code=422, detail="Provide a video file or project_id")

    reserved_credits = _credit_cost(input_duration)
    try:
        _deduct_credits(user.id, reserved_credits)
    except Exception:
        if cleanup_input:
            _remove_temp_file(temp_input_path)
        raise

    job = job_store.create(user_id=user.id, project_id=project_id)
    try:
        background_tasks.add_task(
            process_transcription_job,
            job.id,
            temp_input_path,
            language,
            style,
            provider,
            project_id,
            cleanup_input,
            reserved_credits,
            user.id,
        )
    except Exception:
        _refund_credits(user.id, reserved_credits)
        if cleanup_input:
            _remove_temp_file(temp_input_path)
        raise

    return {"job_id": job.id, "status": "queued", "credits_charged": reserved_credits}

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, user: User = Depends(get_current_user)):
    job = job_store.get(job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.model_dump()
