# UASK Backend

## Setup

1. Copy `.env.example` to `.env` and update values as needed:
   ```bash
   cp .env.example .env
   ```

2. Start PostgreSQL:
   ```bash
   docker compose up -d
   ```

3. Create a virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   pip install -e ".[dev]"
   ```

4. Run database migrations:
   ```bash
   alembic upgrade head
   ```

5. Start the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

6. Verify the API is running:
   ```
   GET http://localhost:8000/api/v1/health
   ```

## Seed Development Data

Generate realistic local data (6 users, 8 ASKs, 15 offers) after migrations:

```bash
python scripts/seed.py           # seed an empty development database
python scripts/seed.py --reset   # wipe all tables, then seed fresh data
```

Without `--reset` the script refuses to touch a database that already
contains data, so re-running it is always safe. It also refuses to run when
`ENV` is not `development` or `test` — seeding never happens in production,
and seed data lives only in `scripts/seed.py`, never in migrations.

Seeded accounts (password for all: `password123`):

| Email              | Roles             | Name          |
| ------------------ | ----------------- | ------------- |
| alice@uask.dev     | seeker            | Alice Rivera  |
| bob@uask.dev       | seeker            | Bob Patel     |
| carol@uask.dev     | provider          | Carol Nguyen  |
| dave@uask.dev      | provider          | Dave Kim      |
| erin@uask.dev      | provider          | Erin Sato     |
| frank@uask.dev     | seeker,provider   | Frank Osei    |

ASK states: 5 open (all 8 categories covered), 2 closed with accepted and
rejected offers, 1 cancelled. `alice@uask.dev`'s logo ASK has 4 live offers
for exercising the compare endpoint.

## Configuration

Every environment-specific value comes from the environment (or `.env`,
which is gitignored). `.env.example` is the committed template and holds
placeholders only.

| Variable | Purpose |
| --- | --- |
| `ENV` | `development` \| `test` \| `production` — drives cookie flags, docs and secret checks |
| `DEBUG` | forces `DEBUG` log level when `true` |
| `LOG_LEVEL`, `LOG_FORMAT` | `DEBUG`…`CRITICAL`, `json` \| `plain` |
| `DATABASE_URL`, `TEST_DATABASE_URL` | PostgreSQL DSNs (never committed) |
| `JWT_SECRET`, `JWT_ALGORITHM` | HS256 signing material; production requires a unique 32+ char secret |
| `CORS_ORIGINS`, `FRONTEND_URL` | explicit origins only — `*` is rejected at startup |
| `COOKIE_SECURE`, `COOKIE_DOMAIN`, `BEHIND_PROXY` | cookie hardening, `X-Forwarded-For` trust |
| `STORAGE_PROVIDER`, `SUPABASE_*`, `UPLOAD_*` | upload storage backend |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_RECYCLE`, `DB_POOL_PRE_PING` | connection pool |
| `RATE_LIMIT_*` | per-bucket fixed windows, see below |

Startup fails fast on an unsafe configuration: a wildcard CORS origin, a
non-HS* JWT algorithm, an unknown log level, or a placeholder/short
`JWT_SECRET` when `ENV=production`.

## Rate limiting

Fixed-window limits held in process (each Uvicorn worker counts its own),
applied as FastAPI dependencies — auth buckets keyed by client IP, upload
and message buckets keyed by user id:

| Bucket | Route | Default |
| --- | --- | --- |
| `login` | `POST /auth/login` | 10 / 60s per IP |
| `signup` | `POST /auth/signup` | 10 / 60s per IP |
| `refresh` | `POST /auth/refresh` | 30 / 60s per IP |
| `upload` | `POST /uploads` | 60 / 60s per user |
| `message` | `POST /threads/{id}/messages` | 120 / 60s per user |

Over the limit → `429` with error envelope `RATE_LIMITED` and a
`Retry-After` header. Set `RATE_LIMIT_ENABLED=false` to turn everything
off (tests do this), or raise the `RATE_LIMIT_*_MAX` values per bucket.

## Health & readiness

```
GET /api/v1/health   → 200 {"status": "ok", "version": "0.1.0"}   (process alive, no dependencies)
GET /api/v1/ready    → 200 {"status": "ready", "checks": {"database": "ok", "storage": "ok"}}
                       503 {"status": "unavailable", "checks": {...}}   (dependency down)
```

Both are unauthenticated and never return exception text, DSNs or
credentials.

## Logging

Structured JSON lines on stdout (`LOG_FORMAT=plain` for local reading):
one `http_request` line per request with method, path, status, duration
and `requestId`, plus `startup`/`shutdown`, `authz_failure`,
`database_error`, `storage` and `unhandled_error` events. Tracebacks are
logged **server-side only** with the `requestId`; responses always carry
the generic `INTERNAL_ERROR` body. Passwords, access tokens, refresh
tokens, JWT secrets and message bodies are never logged.

## Production / staging

Development uses `uvicorn app.main:app --reload`. Production must not.

```bash
# start command (Render / Railway "start command" field)
sh scripts/start.sh
# equivalent, expanded:
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers "$WEB_CONCURRENCY" --proxy-headers
```

`scripts/start.sh` migrates first, then serves with Uvicorn workers —
no `--reload`, no interactive docs (`/docs`, `/redoc` and `/openapi.json`
are disabled when `ENV=production`).

Deployment checklist:

1. Provision PostgreSQL (Supabase session pooler on port `5432`, or a
   managed Postgres) and set `DATABASE_URL`.
2. `openssl rand -hex 32` → `JWT_SECRET`; `ENV=production`;
   `COOKIE_SECURE=true`; `BEHIND_PROXY=true` behind the platform proxy.
3. `FRONTEND_URL` + `CORS_ORIGINS` → the exact deployed frontend origin
   (explicit origins only, `allow_credentials` stays on for the refresh
   cookie).
4. `STORAGE_PROVIDER=supabase` with `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` — or leave
   `local` for a single-instance staging box.
5. Release command: `sh scripts/start.sh` (runs `alembic upgrade head`).
6. Point probes at `/api/v1/health` (liveness) and `/api/v1/ready`
   (readiness).

Nothing has been deployed from this repo yet — this phase only prepares it.

## Project Structure

```
backend/
├── app/
│   ├── api/v1/routes/    # Route handlers
│   ├── core/             # Config, dependencies
│   ├── db/               # Base, session
│   ├── models/           # SQLAlchemy models (Phase 2)
│   ├── schemas/          # Pydantic schemas (Phase 2)
│   ├── repositories/     # Data access (Phase 2)
│   ├── services/         # Business logic (Phase 2)
│   ├── storage/          # Storage backends (local disk for dev, Supabase Storage)
│   ├── utils/            # Utilities
│   └── main.py           # FastAPI app
├── alembic/              # Database migrations
├── tests/                # Test suite
├── pyproject.toml        # Project config
└── docker-compose.yml    # PostgreSQL service
```
