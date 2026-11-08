"""One-time copy of application records from local SQLite to PostgreSQL.

Run from backend after setting DATABASE_URL to the target PostgreSQL URL:
  python scripts/migrate_sqlite_to_postgres.py --sqlite-path ./captionkit.db
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from sqlalchemy import MetaData, Table, create_engine, inspect, select, text

from app.core.settings import settings
from app.database_config import create_database_engine, normalize_database_url
from app.models import Base


TABLE_ORDER = ("users", "projects", "cues", "export_feedback")


def migrate(sqlite_path: Path, target_url: str) -> dict[str, int]:
    if not sqlite_path.is_file():
        raise FileNotFoundError(f"SQLite database not found: {sqlite_path}")
    source = create_engine(f"sqlite:///{sqlite_path.resolve().as_posix()}")
    normalized_target = normalize_database_url(target_url)
    if not normalized_target.startswith("postgresql+"):
        raise ValueError("DATABASE_URL must point to PostgreSQL for this migration")
    target = create_database_engine(target_url)
    Base.metadata.create_all(target)
    copied: dict[str, int] = {}
    try:
        source_meta, target_meta = MetaData(), MetaData()
        source_meta.reflect(bind=source)
        target_meta.reflect(bind=target)
        with source.connect() as source_conn, target.begin() as target_conn:
            for name in TABLE_ORDER:
                if name not in source_meta.tables or name not in target_meta.tables:
                    continue
                source_table = source_meta.tables[name]
                target_table = target_meta.tables[name]
                source_rows = source_conn.execute(select(source_table)).mappings().all()
                primary_keys = list(target_table.primary_key.columns)
                existing = set()
                if primary_keys:
                    existing = {tuple(row) for row in target_conn.execute(select(*primary_keys)).all()}
                missing = []
                for row in source_rows:
                    values = dict(row)
                    key = tuple(values[column.name] for column in primary_keys)
                    if key not in existing:
                        missing.append(values)
                        existing.add(key)
                if missing:
                    target_conn.execute(target_table.insert(), missing)
                copied[name] = len(missing)
                if target.dialect.name == "postgresql":
                    for column in primary_keys:
                        if column.autoincrement is True or column.type.python_type is int and name in {"cues", "export_feedback"}:
                            target_conn.execute(text(
                                "SELECT setval(pg_get_serial_sequence(:table_name, :column_name), "
                                "GREATEST(COALESCE((SELECT MAX(" + column.name + ") FROM " + name + "), 1), 1), "
                                "EXISTS (SELECT 1 FROM " + name + "))"
                            ), {"table_name": name, "column_name": column.name})
        return copied
    finally:
        source.dispose()
        target.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite-path", default=os.getenv("DATABASE_PATH") or settings.DATABASE_PATH or "./data/app.db")
    args = parser.parse_args()
    if not settings.DATABASE_URL:
        parser.error("Set DATABASE_URL to the target PostgreSQL database first")
    counts = migrate(Path(args.sqlite_path), settings.DATABASE_URL)
    print("Migration complete. Rows copied by table:")
    for name, count in counts.items():
        print(f"{name}: {count}")


if __name__ == "__main__":
    main()
