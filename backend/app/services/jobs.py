import uuid
import time
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

class JobState(BaseModel):
    id: str
    status: str = "queued" # queued, processing, completed, failed
    progress: int = 0
    cues: List[Dict[str, Any]] = Field(default_factory=list)
    text: str = ""
    words: List[Dict[str, Any]] = Field(default_factory=list)
    provider_used: str = ""
    fallback_occurred: bool = False
    fallback_message: Optional[str] = None
    error: Optional[str] = None
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)

class JobStore:
    def __init__(self):
        self._jobs: Dict[str, JobState] = {}

    def create(self) -> JobState:
        job_id = str(uuid.uuid4())
        job = JobState(id=job_id)
        self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> Optional[JobState]:
        return self._jobs.get(job_id)

    def update(self, job_id: str, **kwargs) -> Optional[JobState]:
        job = self._jobs.get(job_id)
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            job.updated_at = time.time()
        return job

job_store = JobStore()
