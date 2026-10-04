# Staging Deployment — Render (Phase 8)

Platform: **Render** (blueprint `render.yaml` at the repo root). Chosen over
Railway because the repo already targets Render (proxy/pooling comments,
`scripts/start.sh`, `PORT` handling), Render needs no Dockerfile, and the
blueprint encodes every env var declaratively. PostgreSQL is Render-managed
(or any external Postgres) — **never SQLite**. Uploads go to Supabase Storage
because Render's filesystem is ephemeral across redeploys.

`API_CONTRACT.md` does not exist in this repo; the contract is
`backend/AGENTS.md` (frozen rows) plus `UASK_BACKEND_BLUEPRINT.md`.

## 0. Pre-deployment verification (already run, Phase 8)

| Check | Result |
| --- | --- |
| Start command | `sh scripts/start.sh` → `alembic upgrade head` then `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers $WEB_CONCURRENCY --proxy-headers` — no `--reload` |
| Dependencies | `backend/requirements.txt` (pinned, `pip install --dry-run` resolves clean) |
| DATABASE_URL | required setting; `postgres://` and bare `postgresql://` are normalized to `postgresql+psycopg://` at startup |
| Alembic | single head `d6a2c4f81b97`; `sqlalchemy.url` comes from app settings; migrations run in `start.sh` |
| Storage | `STORAGE_PROVIDER=supabase` fails fast at startup if any Supabase var is missing; `local` is dev-only |
| CORS | explicit origins from `CORS_ORIGINS` + `FRONTEND_URL`; `*` rejected at startup; credentials stay enabled |
| `/health` | 200 `{"status":"ok","version":"0.1.0"}`, no auth, no DB dependency |
| `/ready` | 200/503 `{"status":…,"checks":{"database":"ok"\|"error","storage":"ok"\|"error"}}` |
| Docs | hidden under `ENV=production` unless `DOCS_ENABLED=true` (staging sets it) |

## 1. One-time Supabase setup (storage)

1. Create a Supabase project → **Storage → New bucket** → name e.g.
   `uask-uploads`, **Public bucket = ON** (the API returns public URLs; the
   contract forbids signed URLs).
2. **Project Settings → API**: copy `Project URL` and the `service_role` key.
3. Put them in the Render env vars below as `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=uask-uploads`.
   The service-role key is a secret: dashboard only, never in git.

## 2. Deploy — Path A: blueprint (recommended)

1. Render dashboard → **New → Blueprint** → connect the GitHub repo
   `hetvidesai01/uask` → Render finds `render.yaml` at the repo root.
2. Review the parsed services. Adjust if Render complains:
   - database `plan: free` is not offered → pick the cheapest Postgres plan
     (~$7/mo Starter), or delete the `databases:` block and wire an external
     Postgres (Path B, DATABASE_URL row);
   - `PYTHON_VERSION: 3.12.11` unavailable → use any offered 3.12.x/3.13.x.
3. Fill the three prompted (`sync: false`) values: `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`; optionally
   `FRONTEND_URL` (leave unset until the frontend is deployed).
4. **Apply** → Render creates the DB, runs `buildCommand`, then
   `startCommand` (which migrates first).

## 3. Deploy — Path B: manual dashboard (same result)

1. **New → PostgreSQL** → name `uask-staging-db`, region oregon, DB `uask`,
   cheapest plan → create. Copy its **External Database URL**.
2. **New → Web Service** → connect repo → Runtime: **Python** →
   Root Directory: `backend`.
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `sh scripts/start.sh`
   - Instance: Free (or higher for always-on)
3. **Environment** → add every row from the table below (paste values only,
   never commit them).

### Exact environment variables for the hosting dashboard

| Key | Staging value | Notes |
| --- | --- | --- |
| `ENV` | `production` | enables prod guards (secret strength, cookies) |
| `DEBUG` | `false` | |
| `LOG_LEVEL` | `INFO` | |
| `LOG_FORMAT` | `json` | structured logs on stdout |
| `DOCS_ENABLED` | `true` | exposes `/docs` + `/openapi.json` on staging |
| `API_V1_PREFIX` | `/api/v1` | default; optional |
| `DATABASE_URL` | `postgres://…` from Render Postgres (auto in Path A) | normalized at startup |
| `TEST_DATABASE_URL` | *omit* | tests only — never needed on the host |
| `JWT_SECRET` | `<openssl rand -hex 32>` (Render `generateValue` in Path A) | ≥32 chars or boot fails |
| `JWT_ALGORITHM` | `HS256` | default; optional |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | default; optional |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | default; optional |
| `CORS_ORIGINS` | `http://localhost:5173` | local frontend dev origin |
| `FRONTEND_URL` | *(unset for now)* | future deployed frontend origin — add it here when the frontend ships |
| `COOKIE_SECURE` | `true` | Render serves HTTPS |
| `COOKIE_DOMAIN` | *(unset)* | |
| `BEHIND_PROXY` | `true` | trust `X-Forwarded-For` / `--proxy-headers` |
| `STORAGE_PROVIDER` | `supabase` | **never `local` on Render** (ephemeral disk) |
| `SUPABASE_URL` | `https://PROJECT.supabase.co` | from Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service-role key>` | secret; dashboard only |
| `SUPABASE_STORAGE_BUCKET` | `uask-uploads` | public bucket from step 1 |
| `UPLOAD_MAX_MB` | `10` | default |
| `UPLOAD_DIR` | `uploads` | unused while provider is `supabase` |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` / `DB_POOL_RECYCLE` / `DB_POOL_PRE_PING` | `5` / `10` / `1800` / `true` | defaults |
| `RATE_LIMIT_ENABLED` | `true` | optional per-bucket `RATE_LIMIT_*_MAX` / `_WINDOW_SECONDS` |
| `WEB_CONCURRENCY` | `1` | one worker on the 512MB free instance |
| `PORT` | *set by Render* | consumed by `scripts/start.sh` |

Never paste real secrets into `render.yaml`, `.env.example`, docs, chat logs
or git — `.env` is gitignored and the blueprint only uses `generateValue` /
`sync: false` for secrets.

## 4. Database migrations (item 4)

- `alembic upgrade head` runs automatically on every boot/redeploy via
  `scripts/start.sh` — single head `d6a2c4f81b97`, no manual table DDL ever.
- Render: on paid instance types you may additionally set
  **Settings → Pre-Deploy Command:** `alembic upgrade head` for
  migrate-before-traffic semantics; free instances have no pre-deploy hook,
  so boot-time migration applies (safe: the migration set is additive).
- Verify after deploy:
  ```bash
  curl -s https://<backend>/api/v1/ready   # checks database: ok
  ```

## 5. Seed data (item 5) — manual, one-time, never on deploy

Seeding is **not** part of startup, the start command, or any hook.
`scripts/seed.py` refuses to run unless `ENV` is `development`/`test`, and
refuses to touch a database that already has data (re-run needs `--reset`).
One-time staging seed (run from `backend/`, pointed at staging, then leave
it alone):

```bash
# DATABASE_URL = staging External Database URL (the real one, never committed)
ENV=development DATABASE_URL="postgres://…" python scripts/seed.py
```

Seeded logins (if you seed): `alice@uask.dev` … `frank@uask.dev`,
password `password123`. Omit this step entirely if staging should hold only
real data.

## 6. Storage (item 6) — persistence verification

1. Upload through the API (see smoke test): response must be
   `201 {id, name, url, size, mimeType}` with a Supabase public URL
   (`https://PROJECT.supabase.co/storage/v1/object/public/uask-uploads/…`).
2. `GET` the returned `url` → 200 image bytes.
3. Trigger a redeploy (push or dashboard **Manual Deploy**) → the same URL
   must still serve the file (Supabase survives; a local-disk file would
   not — that is why `STORAGE_PROVIDER=local` is forbidden here).

## 7. CORS (item 7)

`CORS_ORIGINS=http://localhost:5173` covers the current local frontend;
`FRONTEND_URL` (also CORS-allowed) is for the future deployed frontend
origin. Credentials/cookies stay enabled, `*` is rejected at startup.
When the frontend gets a domain: add it as `FRONTEND_URL` (or extend
`CORS_ORIGINS`) and redeploy — no code change.

## 8. Post-deploy verification (items 8–10)

Run against the public URL: `/health`, `/ready`, `/docs`; signup →
login → `GET /users/me`; one read endpoint (`GET /asks`); full smoke flow
(signup → profile → create ASK → read ASK back → second user responds →
seeker sees the response); contract basics (camelCase keys, error envelope,
pagination shape, persistence across restart).

## 9. URLs (item 11)

| What | URL |
| --- | --- |
| Backend root | `https://<service>.onrender.com` |
| API base | `https://<service>.onrender.com/api/v1` |
| Swagger | `https://<service>.onrender.com/docs` |
| Health | `https://<service>.onrender.com/api/v1/health` |
| Readiness | `https://<service>.onrender.com/api/v1/ready` |

## 10. Known limitations

- Free Render instance **sleeps** after ~15 min idle → first request takes
  30–60 s (cold start); health checks pass because `/health` is dependency-free.
- Rate-limit counters are per-process (per worker/instance) — fine for a
  single-instance staging box.
- `uvicorn --workers 1` (`WEB_CONCURRENCY=1`) on the free plan; raise with
  the instance type.
- Frontend integration is **not** done here — this phase stops at a verified
  backend URL.
