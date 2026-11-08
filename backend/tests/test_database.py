import unittest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database_config import normalize_database_url
from app.models import Base, Project, User


class DatabaseConfigTests(unittest.TestCase):
    def test_empty_and_sqlite_database_urls_keep_local_path_support(self):
        self.assertTrue(normalize_database_url("", "./local.db").startswith("sqlite:///"))
        self.assertTrue(normalize_database_url("sqlite:///./legacy.db").startswith("sqlite:///"))

    def test_postgres_urls_use_psycopg_and_require_remote_ssl(self):
        normalized = normalize_database_url("postgres://user:pass@db.example.com/padalu")
        self.assertTrue(normalized.startswith("postgresql+psycopg://"))
        self.assertIn("sslmode=require", normalized)


class UserProjectPersistenceTests(unittest.TestCase):
    def test_user_project_and_credit_update_persist_in_sqlite(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            user = User(id="user-1", google_sub="google-unique-1", email="creator@example.test", name="Creator", credits=20)
            db.add(user)
            db.flush()
            project = Project(id="project-1", user_id=user.id, title="My project", file_name="clip.mp4", size=1234, duration=12.0)
            db.add(project)
            user.credits -= 2
            db.commit()
            db.expire_all()
            saved_user = db.get(User, "user-1")
            saved_project = db.scalar(select(Project).where(Project.id == "project-1"))
            self.assertEqual(saved_user.credits, 18)
            self.assertEqual(saved_project.user_id, saved_user.id)
        engine.dispose()

    def test_google_account_identifier_is_unique(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            db.add_all([
                User(id="user-1", google_sub="same-google-id", email="one@example.test"),
                User(id="user-2", google_sub="same-google-id", email="two@example.test"),
            ])
            with self.assertRaises(Exception):
                db.commit()
        engine.dispose()


if __name__ == "__main__":
    unittest.main()
