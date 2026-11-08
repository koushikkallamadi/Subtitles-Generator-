from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.settings import settings
from app.database_config import create_database_engine


class Base(DeclarativeBase):
    pass


engine = create_database_engine(settings.DATABASE_URL, settings.DATABASE_PATH)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
