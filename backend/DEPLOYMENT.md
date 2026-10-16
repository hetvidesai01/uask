# Staging Deployment — Render (Phase 8)

Decisions: **Render** web service (native Python, no Dockerfile),
**Supabase Storage** for uploads, **staging Swagger enabled** via
`ENABLE_DOCS=true` while `ENV=production` keeps every production security
guard on, database = **Supabase Postgres (free)** by default with
**Render Postgres (paid)** as the alternative.

`API_CONTRACT.md` does not exist in this repo; the contract is
`backend/AGENTS.md` (frozen rows) plus `UASK_BACKEND_BLUEPRINT.md`.

## 0. Pre-deployment verification (already run, Phase 8)

| Check | Result |
| --- | --- |
| Root directory | `backend` (monorepo; frontend stays at the repo root) |
| Runtime | Python 3.12 (native PaaS — the repo does not need Docker) |
| Build command | `pip install -r requirements.txt` (pinned, dry-run resolves clean) |
| Start command | `sh scripts/start.sh` → `alembic upgrade head` then `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers $WEB_CONCURRENCY --proxy-headers` — **no `--reload`** |
| Pre-deploy/migration | `alembic upgrade head` (runs inside `start.sh` on every boot; optional Render Pre-Deploy Command on paid instance types) |
| Health-check path | `/api/v1/health` (200, no auth, no DB dependency) |
| DATABASE_URL | required; `postgres://` / `postgresql://` normalized to `postgresql+psycopg://` at startup (works with Render *and* Supabase connection strings) |
| Alembic | single head `d6a2c4f81b97`; `sqlalchemy.url` read from app settings; no manual DDL ever |
| Storage | `STORAGE_PROVIDER=supabase` fails fast at boot if any `SUPABASE_*` var is missing; `local` is dev-only and forbidden on Render (ephemeral disk) |
| CORS | explicit origins from `CORS_ORIGINS` + `FRONTEND_URL`; `*` rejected at startup; credentials stay enabled |
| Docs | `ENV=production` hides `/docs` **unless** `ENABLE_DOCS=true` (staging); production later sets `ENABLE_DOCS=false` (or omits it) |
| `/health` | 200 `{"status":"ok","version":"0.1.0"}` |
| `/ready` | 200/503 `{"status":…,"checks":{"database":"ok"\|"error","storage":"ok"\|"error"}}` |

## 1. Supabase Storage (what to create — secrets go to Render, not chat)

1. Supabase dashboard → your project → **Storage → New bucket**
   - Bucket name (`<BUCKET_NAME>`): `uask-uploads`
   - **Public bucket: ON** — the API returns public URLs
     (`…/storage/v1/object/public/<BUCKET_NAME>/<key>`); the contract
     forbids signed URLs, so private buckets will not work.
2. **Project Settings → API** → copy:
   - `Project URL` → `<SUPABASE_URL>` (e.g. `https://abcdefgh.supabase.co`)
   - `service_role` secret → `<SUPABASE_SERVICE_ROLE_KEY>`
3. Enter both in Render's environment (steps below). **Never paste them
   into chat, docs or git** — `.env` is gitignored, `render.yaml` only uses
   `sync: false` placeholders for them.

Required by the code (`app/storage/__init__.py`): `STORAGE_PROVIDER=supabase`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`.

## 2. PostgreSQL — two compatible options

No SQLite anywhere.

**Option A (recommended, free): Supabase Postgres** — same project you
already created for storage, zero extra cost, and fully compatible with the
current SQLAlchemy 2 + Alembic + psycopg 3 setup.

1. Supabase → **Project Settings → Database** → connection string
   - Use the **Session pooler** host and **port 5432**
     (`postgresql://postgres.<PROJECT-REF>:<DB-PASSWORD>@aws-0.<region>.pooler.supabase.com:5432/postgres`).
     The session pooler is the external-host path (direct `db.<ref>` needs
     IPv6); port 5432 keeps it on the standard pooler port.
2. Paste that string (with `?sslmode=require`) as `DATABASE_URL` in Render.
   The app rewrites `postgresql://` → `postgresql+psycopg://` automatically.
3. Caveats: Supabase **free tier pauses a project after ~7 days of
   inactivity** (staging `/ready` fails until you resume it), and it is a
   shared pool — fine for staging.

**Option B (paid): Render-managed Postgres** — Render's database instances
are **not free for new customers**; the cheapest is Starter ≈ **$7/mo**
(the legacy free Postgres tier is gone). Simplest integration (no paste,
`fromDatabase` wiring) but it costs money.

Migration command is the same either way: `alembic upgrade head`
(automatic via `scripts/start.sh`).

## 3. Render environment variables

**Required**

| Key | Value | Notes |
| --- | --- | --- |
| `ENV` | `production` | production cookie/secret guards stay on |
| `ENABLE_DOCS` | `true` (staging) / `false` (production later) | only knob that changes docs; no other guard is weakened |
| `DATABASE_URL` | `<SESSION_POOLER_URL>` | Option A paste, or Render's auto value (Option B) |
| `JWT_SECRET` | `<openssl rand -hex 32>` | Render blueprint uses `generateValue`; <32 chars → boot fails |
| `CORS_ORIGINS` | `http://localhost:5173` | current local frontend |
| `STORAGE_PROVIDER` | `supabase` | never `local` on Render |
| `SUPABASE_URL` | `<SUPABASE_URL>` | |
| `SUPABASE_SERVICE_ROLE_KEY` | `<SUPABASE_SERVICE_ROLE_KEY>` | secret |
| `SUPABASE_STORAGE_BUCKET` | `<BUCKET_NAME>` (e.g. `uask-uploads`) | public bucket |
| `COOKIE_SECURE` | `true` | Render serves HTTPS |
| `BEHIND_PROXY` | `true` | trust Render's `X-Forwarded-For` / `--proxy-headers` |

**Optional / defaults (set only to override)**

| Key | Default | Notes |
| --- | --- | --- |
| `DEBUG` | `false` | |
| `LOG_LEVEL` / `LOG_FORMAT` | `INFO` / `json` | structured logs on stdout |
| `API_V1_PREFIX` | `/api/v1` | |
| `JWT_ALGORITHM` | `HS256` | HS* only, validated at boot |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | `15` / `7` | |
| `FRONTEND_URL` | *(unset)* | **add the deployed frontend domain here later** — it is merged into CORS automatically |
| `COOKIE_DOMAIN` | *(unset)* | |
| `UPLOAD_MAX_MB` / `UPLOAD_DIR` | `10` / `uploads` | `UPLOAD_DIR` unused under `supabase` |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` / `DB_POOL_RECYCLE` / `DB_POOL_PRE_PING` | `5` / `10` / `1800` / `true` | |
| `RATE_LIMIT_ENABLED` | `true` | per-bucket `RATE_LIMIT_{LOGIN,SIGNUP,REFRESH,UPLOAD,MESSAGE}_{MAX,WINDOW_SECONDS}` |
| `WEB_CONCURRENCY` | `1` | one worker on the 512MB free instance (script default is 2) |
| `PORT` | *set by Render* | consumed by `scripts/start.sh` |
| `TEST_DATABASE_URL` | *(omit on staging)* | tests only |

## 4. Dashboard steps (you click, I instruct)

**Path A — blueprint (fewest clicks; `render.yaml` at the repo root)**

1. Go to Render → **New → Blueprint** → **Connect a repository** → pick
   GitHub repo `hetvidesai01/uask` (branch **`backend`**) → Authorize.
2. Render parses `render.yaml` → review the service card
   (`rootDir: backend`, Python runtime, build/start/health as in §0).
   If Render flags `plan: free` for the instance or `PYTHON_VERSION:
   3.12.11`, pick the offered equivalents (any 3.12.x/3.13.x).
3. Fill the prompted values: `DATABASE_URL`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`; leave
   `FRONTEND_URL` empty for now.
4. **Apply** → Render builds, then starts (migrations run first inside
   `start.sh`).

**Path B — manual Web Service (if the blueprint path is not available)**

1. **New → Web Service** → connect GitHub repo `hetvidesai01/uask` →
   **Branch: `backend`**.
2. Settings card:
   - Name: `uask-backend-staging`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3` (native — no Docker)
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `sh scripts/start.sh`
   - **Health Check Path:** `/api/v1/health`
   - Instance Type: **Free**
3. **Environment → Add Environment** → enter every row of §3 (Required
   first). Secrets go here only.
4. **Create Web Service** → wait for the first deploy to go green.

**Optional pre-deploy command** (paid instance types only):
Settings → **Pre-Deploy Command** → `alembic upgrade head`. On the free
plan there is no pre-deploy hook; migrations still run at boot via
`start.sh`, which is safe for this additive migration set.

## 5. Seed data — manual, one-time, never on deploy

Seeding is **not** in the start command, hooks, or CI.
`scripts/seed.py` runs only when `ENV` is `development`/`test` and refuses
a database that already has data (`--reset` to wipe):

```bash
# from backend/, DATABASE_URL = staging session-pooler URL (never committed)
ENV=development DATABASE_URL="postgresql://…" python scripts/seed.py
```

Accounts: `alice@uask.dev` … `frank@uask.dev`, password `password123`.
Skip this entirely if staging should hold only real data.

## 6. Storage persistence check (after deploy)

1. Upload via `POST /api/v1/uploads` (multipart, no `entityType` needed) →
   `201 {id, name, url, size, mimeType}` with a
   `…/storage/v1/object/public/<BUCKET_NAME>/…` URL.
2. `GET` that URL → 200 image bytes.
3. Trigger a redeploy (push or **Manual Deploy**) → the same URL must still
   serve the file. Supabase survives redeploys; local disk would not.

## 7. CORS

`CORS_ORIGINS=http://localhost:5173` keeps the local Vite dev app working.
To allow the deployed frontend later: set `FRONTEND_URL=https://<frontend>`
(or append to `CORS_ORIGINS`) and redeploy — no code change. `*` with
credentials is rejected at startup.

## 8. Post-deploy verification

`/health`, `/ready`, `/docs`, `/openapi.json` → then signup → login →
`GET /auth/me` → `POST /asks` → `GET /asks/{id}` → second account offer →
seeker reads responses → refresh rotation, error envelope, camelCase,
pagination, CORS preflight, upload persistence.

## 9. URLs

| What | URL |
| --- | --- |
| Backend root | `https://<service>.onrender.com` |
| API base | `https://<service>.onrender.com/api/v1` |
| Swagger | `https://<service>.onrender.com/docs` |
| Health | `https://<service>.onrender.com/api/v1/health` |
| Readiness | `https://<service>.onrender.com/api/v1/ready` |

## 10. Known limitations

- Free Render instance sleeps after ~15 min idle → first request takes
  30–60 s (cold start); deploy health checks still pass.
- Rate-limit counters are per-process (per worker/instance).
- Supabase free tier pauses after ~7 days of inactivity — resume the
  project if `/ready` reports `database: error`.
- Frontend integration is **not** part of this phase — it stops at a
  verified backend URL.
