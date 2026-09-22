# UASK Backend — Session Context

## What UASK is

UASK is a reverse marketplace: people post what they need (**ASKs**), providers respond with **offers**, and the platform matches, compares, and connects them.

**Core flow:** `ASK → MATCH → RESPOND → COMPETE → CONNECT`

Authoritative design doc: [`UASK_BACKEND_BLUEPRINT.md`](../UASK_BACKEND_BLUEPRINT.md) at repo root. Read it before non-trivial work.

## Scope rules

- **Frontend is read-only.** Do not edit `src/`, `public/`, `vite.config.js`, or other frontend files from backend work.
- **All backend code lives inside `/backend`.** Never create backend modules at repo root or under `src/`.
- Do not introduce libraries without a reason written in the commit message.
- Do not touch `.env` (local only, gitignored). Use `.env.example` as the template.

## Conventions

| Layer | Convention |
|---|---|
| Python, SQLAlchemy models, DB columns | `snake_case` |
| API JSON request/response bodies | `camelCase` (via `CamelModel` in `app/schemas/base.py`) |
| IDs | UUIDv4, serialize as strings |
| Timestamps | `TIMESTAMPTZ`, UTC, ISO-8601 with `Z` |

**API compatibility with the frontend is required.** Response keys, pagination envelope, and error envelope must match the blueprint §4 and the frontend mock services. Additive fields are OK; renames/removals are not.

## Architecture (three-layer rule)

| Layer | May import | May NOT |
|---|---|---|
| `app/api/` (routes) | schemas, services, deps | touch DB session directly, hold business `if`s |
| `app/services/` | repositories, schemas, enums, exceptions | import FastAPI, write raw SQL, know HTTP status codes |
| `app/repositories/` | models, SQLAlchemy | make authz decisions, raise HTTP errors |

- Ownership/authz checks live in **services**, never routes.
- Routes stay thin: validate → call service → return.
- Every response schema inherits `CamelModel`.
- Every list endpoint returns the pagination envelope.
- Every FK gets an explicit `ondelete=`.
- No `select *` into Pydantic without `response_model` (avoids `password_hash` leaks).

## Style

- **Avoid unnecessary abstraction.** No speculative base classes, no layers that do not pay for themselves yet.
- **One FastAPI monolith.** No microservices, no message queue, no Celery until something actually needs it.
- Prefer plain functions and small modules over deep inheritance.

## Testing

- `pytest` + `TestClient`; real Postgres (`uask_test`), not SQLite (arrays/JSONB/enums/CITEXT).
- Priority: auth flows → authorization (403 for non-owners) → state-machine 409s → accept-offer transaction → pagination → camelCase snapshot tests.
- Target ≥80% coverage on `services/`. Do not chase coverage on routes or models.
- Run: `pytest` from `backend/` (see `pyproject.toml` `[tool.pytest.ini_options]`).

## Phase status — do not redo completed work

**Completed:**

- **Phase 1 — Skeleton (done):** project layout, `config.py`, `db/session.py`, `db/base.py`, `main.py` + CORS, `GET /health`, Alembic init, migration `001` (pgcrypto/citext), `pyproject.toml` installable, `scripts/`, `docker-compose.yml`, local `.env` + running Postgres.
- Phase 1 is committed on branch `backend` (see git log: Phase 1 skeleton + FastAPI setup fix).

**Rules:**

- Do **not** rebuild or re-commit Phase 1.
- Do **not** invent a different folder layout than the blueprint.
- Migrations live in `backend/alembic/versions/` (not `migrations/`).

**Next phase:**

- **Phase 2 — Core plumbing:** `app/core/enums.py`, `app/core/exceptions.py` + handlers, `app/schemas/base.py` (`CamelModel`), `app/core/pagination.py`, `app/repositories/base.py`, request-ID middleware.
- **Done when:** a deliberate error returns the exact error envelope from blueprint §4 (`{error: {code, message, details, requestId}}`).

Then Phase 3 (Auth + User), 4 (Asks), 5 (Offers), 6 (Notifications), 7 (Messaging), 8 (Uploads), 9 (Hardening), 10 (AI matching) — per blueprint §12.

## Commands

```bash
cd backend
# install (once)
python -m venv .venv
.\.venv\Scripts\activate   # Windows
pip install -e ".[dev]"

# run
uvicorn app.main:app --reload
# health: GET http://127.0.0.1:8000/api/v1/health
```
