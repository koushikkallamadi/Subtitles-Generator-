from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base
from app.core.settings import settings


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    google_sub: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    picture: Mapped[str | None] = mapped_column(Text, nullable=True)
    credits: Mapped[float] = mapped_column(Float, nullable=False, default=lambda: settings.FREE_INITIAL_CREDITS)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    last_login_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    duration: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    language: Mapped[str] = mapped_column(String(64), nullable=False, default="Hindi")
    style: Mapped[str] = mapped_column(String(32), nullable=False, default="roman")
    settings_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    cues: Mapped[list["Cue"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Cue(Base):
    __tablename__ = "cues"
    __table_args__ = (UniqueConstraint("project_id", "idx", name="uq_cue_project_idx"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    idx: Mapped[int] = mapped_column(Integer, nullable=False)
    start: Mapped[float] = mapped_column(Float, nullable=False)
    end: Mapped[float] = mapped_column(Float, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    words_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    linked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    project: Mapped[Project] = relationship(back_populates="cues")
