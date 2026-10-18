"""One-shot: create an empty DB, run the full alembic chain from base.

Verifies every migration (base -> 6b8e4a2f19d7) applies cleanly on an
empty PostgreSQL database, exactly as a brand-new staging DB would.
Run: .venv/Scripts/python scripts/verify_migrations_fresh.py
"""
import subprocess
import sys

import psycopg

from app.core.config import get_settings

DBNAME = "uask_migrate_verify"


def main() -> int:
    s = get_settings()
    # Settings normalizes to SQLAlchemy's driver suffix; psycopg needs plain.
    plain = s.DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")
    admin_url = "/".join(plain.split("/")[:-1]) + "/postgres"
    with psycopg.connect(admin_url, autocommit=True) as c:
        c.execute(f"DROP DATABASE IF EXISTS {DBNAME}")
        c.execute(f"CREATE DATABASE {DBNAME}")
    print(f"created empty database {DBNAME}")

    verify_url = "/".join(plain.split("/")[:-1]) + "/" + DBNAME
    import os

    os.environ["DATABASE_URL"] = verify_url
    # Settings are lru_cached; alembic env.py re-reads via get_settings in a
    # subprocess, so passing the env var there is what matters.
    proc = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        env={**os.environ, "DATABASE_URL": verify_url},
        capture_output=True,
        text=True,
    )
    print(proc.stdout[-3000:])
    if proc.returncode != 0:
        print(proc.stderr[-3000:])
        print("MIGRATION FAILED")
        return proc.returncode

    with psycopg.connect(verify_url) as c:
        ver = c.execute("SELECT version_num FROM alembic_version").fetchone()
        n_tables = c.execute(
            "SELECT count(*) FROM information_schema.tables "
            "WHERE table_schema='public'"
        ).fetchone()[0]
    print(f"alembic head on fresh DB: {ver[0]} | tables created: {n_tables}")

    # cleanup
    with psycopg.connect(admin_url, autocommit=True) as c:
        c.execute(f"DROP DATABASE IF EXISTS {DBNAME}")
    print(f"dropped {DBNAME} (cleanup done)")
    print("FULL MIGRATION CHAIN OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
