"""Database URL and engine helpers shared by runtime, migrations, and tests."""
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url


def normalize_database_url(database_url: str | None = None, database_path: str | None = None) -> str:
    value = (database_url or "").strip()
    if not value or value.lower() == "sqlite":
        legacy_path = (database_path or "./data/app.db").strip()
        if legacy_path.startswith("sqlite:///"):
            value = legacy_path
        else:
            path = Path(legacy_path)
            if not path.is_absolute():
                path = Path.cwd() / path
            path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{path.as_posix()}"

    url = make_url(value)
    if url.get_backend_name() == "sqlite":
        if url.database in (None, "", ":memory:"):
            return url.render_as_string(hide_password=False)
        path = Path(url.database)
        if not path.is_absolute():
            path = Path.cwd() / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{path.as_posix()}"

    if value.startswith("postgres://"):
        value = "postgresql+psycopg://" + value[len("postgres://"):]
    elif url.get_backend_name() == "postgresql":
        value = url.set(drivername="postgresql+psycopg").render_as_string(hide_password=False)
    url = make_url(value)
    if url.get_backend_name() != "postgresql":
        raise ValueError("DATABASE_URL must use SQLite or PostgreSQL")
    if url.drivername != "postgresql+psycopg":
        url = url.set(drivername="postgresql+psycopg")
    local_hosts = {"localhost", "127.0.0.1", "::1"}
    if url.host not in local_hosts and "sslmode" not in url.query:
        url = url.update_query_dict({"sslmode": "require"})
    return url.render_as_string(hide_password=False)


def create_database_engine(database_url: str | None = None, database_path: str | None = None):
    normalized = normalize_database_url(database_url, database_path)
    kwargs = {"pool_pre_ping": True}
    if normalized.startswith("sqlite:") and ":memory:" not in normalized:
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(normalized, **kwargs)
