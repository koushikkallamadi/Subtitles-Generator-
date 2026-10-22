import mimetypes
import re
import shutil
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.settings import settings
from app.db import SessionLocal
from app.models import Cue, Project
from app.services.media import get_media_duration

router = APIRouter(tags=["projects"])
STORAGE_ROOT = Path(__file__).resolve().parents[2] / "storage"


class ProjectPatch(BaseModel):
    title: str | None = None
    language: str | None = None
    style: str | None = None
    duration: float | None = None
    settings_json: dict[str, Any] | None = None


class CueInput(BaseModel):
    idx: int | None = None
    start: float
    end: float
    text: str
    words_json: list[dict[str, Any]] = Field(default_factory=list)
    words: list[dict[str, Any]] | None = None
    linked: bool = True


def project_media_path(project_id: str) -> Path | None:
    folder = STORAGE_ROOT / project_id
    if not folder.is_dir():
        return None
    return next((path for path in folder.glob("original.*") if path.is_file()), None)


def project_dict(project: Project) -> dict[str, Any]:
    return {
        "id": project.id, "title": project.title, "file_name": project.file_name,
        "size": project.size, "duration": project.duration, "language": project.language,
        "style": project.style, "settings_json": project.settings_json or {},
        "created_at": project.created_at.isoformat(), "updated_at": project.updated_at.isoformat(),
        "media_available": project_media_path(project.id) is not None,
    }


@router.post("/projects")
async def create_project(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    language: str = Form("Hindi"),
    style: str = Form("roman"),
):
    original_name = Path(file.filename or "video.mp4").name
    suffix = Path(original_name).suffix.lower()
    if not re.fullmatch(r"\.[a-z0-9]{1,10}", suffix):
        suffix = ".mp4"
    project_id = str(uuid.uuid4())
    folder = STORAGE_ROOT / project_id
    folder.mkdir(parents=True, exist_ok=False)
    destination = folder / f"original{suffix}"
    size = 0
    try:
        with destination.open("wb") as target:
            while chunk := await file.read(1024 * 1024):
                target.write(chunk)
                size += len(chunk)
        duration = get_media_duration(str(destination))
        project = Project(
            id=project_id, title=(title or Path(original_name).stem)[:255], file_name=original_name[:255],
            size=size, duration=duration, language=language[:64], style=style[:32], settings_json={},
        )
        with SessionLocal() as db:
            db.add(project)
            db.commit()
            db.refresh(project)
            return project_dict(project)
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    finally:
        await file.close()


@router.get("/projects")
def list_projects():
    with SessionLocal() as db:
        projects = db.scalars(select(Project).order_by(Project.updated_at.desc())).all()
        return [project_dict(project) for project in projects]


@router.get("/projects/{project_id}")
def get_project(project_id: str):
    with SessionLocal() as db:
        project = db.get(Project, project_id)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return project_dict(project)


@router.patch("/projects/{project_id}")
def patch_project(project_id: str, patch: ProjectPatch):
    with SessionLocal() as db:
        project = db.get(Project, project_id)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        values = patch.model_dump(exclude_unset=True)
        for key, value in values.items():
            if value is not None:
                setattr(project, key, value)
        project.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(project)
        return project_dict(project)


@router.delete("/projects/{project_id}")
def delete_project(project_id: str):
    folder = STORAGE_ROOT / project_id
    with SessionLocal() as db:
        project = db.get(Project, project_id)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        db.delete(project)
        db.commit()
    shutil.rmtree(folder, ignore_errors=True)
    return {"deleted": True, "id": project_id}


@router.get("/projects/{project_id}/cues")
def get_project_cues(project_id: str):
    with SessionLocal() as db:
        if db.get(Project, project_id) is None:
            raise HTTPException(status_code=404, detail="Project not found")
        cues = db.scalars(select(Cue).where(Cue.project_id == project_id).order_by(Cue.idx)).all()
        return [{"idx": cue.idx, "start": cue.start, "end": cue.end, "text": cue.text,
                 "words_json": cue.words_json or [], "linked": cue.linked} for cue in cues]


@router.put("/projects/{project_id}/cues")
def put_project_cues(project_id: str, cues: list[CueInput]):
    with SessionLocal() as db:
        project = db.get(Project, project_id)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        db.query(Cue).filter(Cue.project_id == project_id).delete(synchronize_session=False)
        for position, item in enumerate(cues):
            if item.end <= item.start:
                raise HTTPException(status_code=422, detail=f"Cue {position + 1} end must be after start")
            db.add(Cue(
                project_id=project_id, idx=item.idx if item.idx is not None else position,
                start=item.start, end=item.end, text=item.text,
                words_json=item.words if item.words is not None else item.words_json, linked=item.linked,
            ))
        project.updated_at = datetime.utcnow()
        db.commit()
        return {"saved": len(cues)}


@router.get("/media/{project_id}")
def get_project_media(project_id: str, request: Request):
    with SessionLocal() as db:
        if db.get(Project, project_id) is None:
            raise HTTPException(status_code=404, detail="Project not found")
    path = project_media_path(project_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Project media is no longer available")
    size = path.stat().st_size
    range_header = request.headers.get("range")
    start, end, status = 0, size - 1, 200
    headers = {"Accept-Ranges": "bytes", "Content-Length": str(size)}
    if range_header:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not match or (not match.group(1) and not match.group(2)) or size == 0:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}", "Accept-Ranges": "bytes"})
        if match.group(1):
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else size - 1
        else:
            suffix_length = int(match.group(2))
            start = max(0, size - suffix_length)
        if start >= size or end < start:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}", "Accept-Ranges": "bytes"})
        end = min(end, size - 1)
        status = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        headers["Content-Length"] = str(end - start + 1)

    def stream_file():
        remaining = end - start + 1
        with path.open("rb") as source:
            source.seek(start)
            while remaining > 0:
                chunk = source.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    headers["Content-Type"] = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return StreamingResponse(stream_file(), status_code=status, headers=headers)


def cleanup_expired_media():
    cutoff = datetime.utcnow() - timedelta(days=max(0, settings.MEDIA_RETENTION_DAYS))
    with SessionLocal() as db:
        expired = db.scalars(select(Project).where(Project.created_at < cutoff)).all()
        for project in expired:
            shutil.rmtree(STORAGE_ROOT / project.id, ignore_errors=True)
