from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.settings import settings
from pathlib import Path


class Base(DeclarativeBase):
    pass


database_value = settings.DATABASE_PATH
if not database_value and settings.DATABASE_URL and settings.DATABASE_URL.startswith("sqlite:///"):
    database_value = settings.DATABASE_URL.removeprefix("sqlite:///")
database_path = Path(database_value or "./data/app.db")
if not database_path.is_absolute():
    database_path = Path.cwd() / database_path
database_path.parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(f"sqlite:///{database_path.as_posix()}", pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
