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

**Completed — blueprint §12:**

- **Phases 1–7 (done):** skeleton, core plumbing, auth + users, asks, offers, notifications, messaging. All covered by the API test suite.
- **Phase 8 — Uploads (partial):** `POST /uploads`, local disk backend behind `app/storage` interface. Still open: `attachments` table, Supabase Storage backend.
- **Phase 9 — Hardening (partial):** full test suite, seed script, README. Still open: rate limiting on auth routes, structured logging, CI, deploy.
- **Phase 10 — AI matching (not started):** no `matching_service.py`, no `GET /asks/{id}/matches`.
- **Backend Contract Alignment — Phase 1 (done):** ASK `accepted` state, canonical notification names, `lastMessage` object, pagination envelope, currency set. Migration `70311ae197b1`. Contract checks live in `tests/api/test_contract_alignment.py`.

**Rules:**

- Do **not** rebuild or re-commit completed phases.
- Do **not** invent a different folder layout than the blueprint.
- Migrations live in `backend/alembic/versions/` (not `migrations/`). Never edit an applied migration — add a new one.
- Do **not** start a later phase (connections, matching, contracts, search, payments, deployment) without being asked.

**Next phase:** awaiting instruction. Read the frozen contract section below before touching frontend-facing behavior.

## Frozen frontend contract — source of truth

Decided in Backend Contract Alignment Phase 1. The frontend contract wins over the blueprint where they disagree.

| Area | Decision |
|---|---|
| ASK lifecycle | `open`, `matched`, `in_review`, `accepted`, `closed`, plus backend-only `cancelled` (kept, never removed). Accepting an offer sets **`accepted`** — a provider was chosen and work may proceed. `closed` is reserved for finished work. |
| Offer eligibility | Only `open` ASKs accept new offers; anything else → 409 `ASK_NOT_OPEN`. |
| Accepted ASK edits | An `accepted` ASK is immutable, like `closed`/`cancelled` → 409 `ASK_NOT_EDITABLE`. |
| Accept transaction | One atomic transaction: offer accepted, competing offers rejected, ASK → `accepted`, thread created, notifications emitted. Never split into separate commits. |
| Notification types | Canonical on the wire: `offer_received`, `offer_shortlisted`, `offer_accepted`, `offer_rejected`, `ask_matched`, `message`. The API emits these directly — no per-service mapping layer. `ask_closing_soon` and `system` remain as extra backend values. |
| Thread shape | `lastMessage` is an object `{id, body, senderId, createdAt}` or `null`, never a string. The frontend service adapter normalizes/uses this object at integration time. |
| Pagination | `{items, page, pageSize, total, totalPages, hasNext}` on every list endpoint. Never a bare array. Adapters unwrap `items`. |
| Currency | `INR`, `USD`, `EUR`, default `INR`. Generic ISO-4217 3-letter validation stays; no new currencies this phase. |

### Future product rules — preserve, do not implement yet

- **Matching ranks only actual responders** to an ASK — never the whole provider directory.
- **Connections are instant** — no pending or approval state.
- **Connected users may start or reuse the UASK chat thread** for that ASK.

Not built yet: connections, connected-user chat changes, contact privacy fields, responder ranking, contracts, milestones, search, preferences, premium/payments, Supabase uploads, deployment.

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
