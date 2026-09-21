# UASK — Backend Blueprint

**Stack:** Python 3.12 · FastAPI · PostgreSQL 16 · SQLAlchemy 2.0 · Pydantic v2 · Alembic · JWT
**Core flow:** ASK → MATCH → RESPOND → COMPARE → CONNECT
**Shape:** one clean FastAPI monolith. No microservices, no message queue, no Celery until something actually needs it.

---

## 0. Key decisions & assumptions

| Decision | Choice | Why |
|---|---|---|
| Sync vs async SQLAlchemy | **Sync** (`def` endpoints, `Session`) | FastAPI runs sync endpoints in a threadpool. Async SQLAlchemy adds greenlet errors, `await` everywhere, and harder debugging for near-zero gain at your traffic. Switch later if you ever need it. |
| Case convention | **snake_case in Python/DB, camelCase on the wire** | One Pydantic base class does the translation. Frontend needs zero changes. |
| IDs | **UUIDv4** | No sequence leakage, safe to generate client-side later. Serializes as a string — frontend mocks already use strings. |
| Money | `Numeric(12,2)` in DB, serialized as JSON number | Avoids float rounding. `currency` is a separate 3-char code. |
| Timestamps | `TIMESTAMPTZ`, always UTC, serialized as ISO-8601 with `Z` | `new Date(iso)` in JS just works. |
| Passwords | bcrypt via `passlib[bcrypt]` | Well-documented, battle-tested, one line to use. |
| Soft delete | Only on `asks` and `offers` (`deleted_at`) | Users expect "cancelled ASK" history. Everything else hard-deletes. |
| Attachments | `JSONB` array in Phase 1–7, real `attachments` table in Phase 8 | Lets you ship the whole API before touching file storage. |

---

## 1. Folder structure

```
uask-backend/
├─ .env.example
├─ .gitignore
├─ pyproject.toml            # or requirements.txt
├─ alembic.ini
├─ README.md
├─ alembic/
│  ├─ env.py
│  └─ versions/
├─ app/
│  ├─ main.py                # FastAPI app, CORS, routers, exception handlers
│  ├─ core/
│  │  ├─ config.py           # pydantic-settings Settings object
│  │  ├─ security.py         # hash/verify password, encode/decode JWT
│  │  ├─ deps.py             # get_db, get_current_user, require_roles
│  │  ├─ exceptions.py       # AppError hierarchy + handlers
│  │  ├─ pagination.py       # PageParams, Page[T]
│  │  └─ enums.py            # all status enums in one place
│  ├─ db/
│  │  ├─ base.py             # DeclarativeBase + naming_convention + TimestampMixin
│  │  └─ session.py          # engine, SessionLocal
│  ├─ models/                # SQLAlchemy ORM — one file per table
│  │  ├─ user.py  ask.py  offer.py
│  │  ├─ thread.py  thread_participant.py  message.py
│  │  └─ notification.py
│  ├─ schemas/               # Pydantic — one file per entity
│  │  ├─ base.py             # CamelModel (alias generator lives here)
│  │  ├─ auth.py  user.py  ask.py  offer.py
│  │  ├─ thread.py  message.py  notification.py
│  │  └─ common.py           # PageMeta, ErrorResponse, AttachmentRef
│  ├─ repositories/          # pure data access — SQLAlchemy only, no business rules
│  │  ├─ base.py             # generic get/list/create/update/delete
│  │  ├─ user_repo.py  ask_repo.py  offer_repo.py
│  │  ├─ thread_repo.py  message_repo.py  notification_repo.py
│  ├─ services/              # business rules + authorization — no HTTP, no SQL
│  │  ├─ auth_service.py  user_service.py  ask_service.py
│  │  ├─ offer_service.py  thread_service.py  message_service.py
│  │  ├─ notification_service.py
│  │  └─ matching_service.py # Phase 10, stub earlier
│  ├─ api/
│  │  └─ v1/
│  │     ├─ router.py        # includes all sub-routers under /api/v1
│  │     └─ routes/
│  │        ├─ auth.py  users.py  asks.py  offers.py
│  │        ├─ threads.py  messages.py  notifications.py
│  │        └─ health.py
│  └─ utils/
│     ├─ datetime.py  slug.py  validators.py
└─ tests/
   ├─ conftest.py            # db fixture, client fixture, auth fixtures
   ├─ factories.py
   ├─ unit/                  # services with a fake repo
   └─ api/                   # one file per router, hits real endpoints
```

**The three-layer rule — memorize this:**

| Layer | May import | May NOT do |
|---|---|---|
| `api/routes/` | schemas, services, deps | touch the DB session directly, contain business `if`s |
| `services/` | repositories, schemas, enums, exceptions | import FastAPI, write raw SQL, know about HTTP status codes |
| `repositories/` | models, SQLAlchemy | make authorization decisions, raise HTTP errors |

If you follow only one rule from this document, follow that one. It is what keeps the project editable after month three.

---

## 2. Database schema

### `users`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, default `gen_random_uuid()` |
| name | VARCHAR(80) | NOT NULL |
| email | CITEXT | NOT NULL, **UNIQUE** |
| password_hash | VARCHAR(255) | NOT NULL |
| avatar_url | TEXT | NULL |
| roles | `user_role[]` | NOT NULL, default `{seeker}` |
| bio | VARCHAR(1000) | NULL |
| location | VARCHAR(120) | NULL |
| categories | TEXT[] | NOT NULL, default `{}` |
| rating | NUMERIC(2,1) | NOT NULL, default `0.0` — **read-only, derived** |
| review_count | INTEGER | NOT NULL, default `0` — **read-only, derived** |
| is_active | BOOLEAN | NOT NULL, default `true` |
| joined_at | TIMESTAMPTZ | NOT NULL, default `now()` |
| updated_at | TIMESTAMPTZ | NOT NULL, default `now()` |

Indexes: `UNIQUE(email)`, GIN on `categories`, GIN on `roles`.

### `asks`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| requester_id | UUID | **FK → users.id** `ON DELETE CASCADE`, NOT NULL |
| title | VARCHAR(140) | NOT NULL |
| description | TEXT | NOT NULL |
| category | VARCHAR(60) | NOT NULL |
| budget_min | NUMERIC(12,2) | NULL |
| budget_max | NUMERIC(12,2) | NULL |
| currency | CHAR(3) | NOT NULL, default `'INR'` |
| deadline | DATE | NULL |
| location | VARCHAR(120) | NULL |
| is_remote | BOOLEAN | NOT NULL, default `false` |
| status | `ask_status` | NOT NULL, default `'open'` |
| attachments | JSONB | NOT NULL, default `'[]'` |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL |
| deleted_at | TIMESTAMPTZ | NULL (soft delete) |

Constraints: `CHECK (budget_max IS NULL OR budget_min IS NULL OR budget_max >= budget_min)`, `CHECK (deadline IS NULL OR deadline >= created_at::date)`.
Indexes: `(status, created_at DESC)`, `(category)`, `(requester_id)`, GIN full-text on `title || description`.

### `offers`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| ask_id | UUID | **FK → asks.id** `ON DELETE CASCADE`, NOT NULL |
| provider_id | UUID | **FK → users.id** `ON DELETE CASCADE`, NOT NULL |
| price | NUMERIC(12,2) | NOT NULL, `CHECK (price >= 0)` |
| currency | CHAR(3) | NOT NULL, default `'INR'` |
| delivery_days | INTEGER | NOT NULL, `CHECK (delivery_days BETWEEN 1 AND 365)` |
| pitch | TEXT | NOT NULL |
| deliverables | TEXT[] | NOT NULL, default `{}` |
| attachments | JSONB | NOT NULL, default `'[]'` |
| status | `offer_status` | NOT NULL, default `'pending'` |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL |
| deleted_at | TIMESTAMPTZ | NULL |

Constraints: **`UNIQUE (ask_id, provider_id) WHERE deleted_at IS NULL`** — one live offer per provider per ASK.
Indexes: `(ask_id, status)`, `(provider_id, created_at DESC)`.

### `threads`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| ask_id | UUID | FK → asks.id `ON DELETE SET NULL`, NULL |
| offer_id | UUID | FK → offers.id `ON DELETE SET NULL`, NULL |
| last_message_id | UUID | FK → messages.id `ON DELETE SET NULL`, NULL (denormalized) |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL |

`updated_at` is bumped on every new message — it is the sort key for the inbox.

### `thread_participants`
| Column | Type | Constraints |
|---|---|---|
| thread_id | UUID | **FK → threads.id** `ON DELETE CASCADE` |
| user_id | UUID | **FK → users.id** `ON DELETE CASCADE` |
| last_read_at | TIMESTAMPTZ | NOT NULL, default `now()` |
| joined_at | TIMESTAMPTZ | NOT NULL, default `now()` |

**PK = `(thread_id, user_id)`.** Index on `(user_id, thread_id)` for inbox queries.
This table is how `participantIds`, `unreadCount`, and `Message.read` are all derived. There is no `read` column anywhere.

### `messages`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| thread_id | UUID | **FK → threads.id** `ON DELETE CASCADE`, NOT NULL |
| sender_id | UUID | **FK → users.id** `ON DELETE CASCADE`, NOT NULL |
| body | TEXT | NOT NULL, `CHECK (length(body) BETWEEN 1 AND 5000)` |
| attachments | JSONB | NOT NULL, default `'[]'` |
| created_at | TIMESTAMPTZ | NOT NULL |

Index: `(thread_id, created_at DESC)`.

### `notifications`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | **FK → users.id** `ON DELETE CASCADE`, NOT NULL |
| type | `notification_type` | NOT NULL |
| title | VARCHAR(140) | NOT NULL |
| body | VARCHAR(500) | NULL |
| link | VARCHAR(255) | NULL — a frontend path like `/app/asks/<id>` |
| read_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

Index: `(user_id, read_at, created_at DESC)`.

### `refresh_tokens`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id `ON DELETE CASCADE` |
| token_hash | VARCHAR(255) | NOT NULL, UNIQUE |
| expires_at | TIMESTAMPTZ | NOT NULL |
| revoked_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

### Relationship summary

```
User 1──N Ask           (asks.requester_id)
User 1──N Offer         (offers.provider_id)
Ask  1──N Offer         (offers.ask_id)
Ask  1──N Thread        (threads.ask_id, nullable)
Offer 0/1──1 Thread     (threads.offer_id, nullable)
Thread N──N User        via thread_participants
Thread 1──N Message     (messages.thread_id)
User 1──N Message       (messages.sender_id)
User 1──N Notification  (notifications.user_id)
User 1──N RefreshToken  (refresh_tokens.user_id)
```

---

## 3. Status enums (`app/core/enums.py`)

```python
class UserRole(str, Enum):        seeker = "seeker"; provider = "provider"; admin = "admin"
class AskStatus(str, Enum):       open="open"; matched="matched"; in_review="in_review"; closed="closed"; cancelled="cancelled"
class OfferStatus(str, Enum):     pending="pending"; shortlisted="shortlisted"; accepted="accepted"; rejected="rejected"; withdrawn="withdrawn"
class NotificationType(str, Enum):
    ask_new_offer; offer_shortlisted; offer_accepted; offer_rejected
    ask_closing_soon; new_message; ask_matched; system
```

All are created as **native PostgreSQL enum types** via Alembic so the DB rejects bad values too.

### Allowed transitions — enforce these in the service layer, not the DB

**Ask:** `open → matched → in_review → closed`; `open|matched|in_review → cancelled`. `closed` and `cancelled` are terminal.
**Offer:** `pending → shortlisted → accepted|rejected`; `pending → rejected`; `pending|shortlisted → withdrawn` (provider only). `accepted`, `rejected`, `withdrawn` are terminal.

**Accepting an offer is one transaction:** set that offer `accepted` → set every other `pending`/`shortlisted` offer on the ASK to `rejected` → set the ASK to `closed` → create a thread between seeker and provider → emit notifications to all affected providers. If any step fails, all of it rolls back.

---

## 4. Frontend compatibility

### The camelCase bridge

`app/schemas/base.py` — every response schema inherits this and nothing else is needed:

```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,      # accept snake_case input too
        from_attributes=True,       # read straight off SQLAlchemy objects
    )
```

Result: Python writes `budget_min`, the API emits `budgetMin`, and your frontend service layer needs no mapping code.

### Fields that need transformation — flagged

| Frontend field | Backend reality | Action |
|---|---|---|
| `User.rating`, `User.reviewCount` | No Review entity in scope | **Read-only.** Return `0` / `0` until a reviews feature exists. Never accept in `PATCH /users/me`. |
| `User.roles` | Postgres `user_role[]` | Returns as JSON array of strings. Matches frontend. **Only admins may grant `admin`.** |
| `User.categories` | `TEXT[]` | Free-text array in Phase 1–7; validate against a fixed list in `utils/validators.py`. Promote to a `categories` table only if you build an admin UI. |
| `Ask.responseCount` | Not a column | **Computed** via `COUNT(offers WHERE deleted_at IS NULL)`. Read-only, rejected in write payloads. |
| `Ask.attachments` | JSONB array | Shape: `[{id, name, url, size, mimeType}]`. Frontend blueprint says "filename chips only" — this shape works for both phases. |
| `Ask.requesterId` | FK column | Kept. **Additively** also return a nested `requester: {id, name, avatarUrl, rating}` so cards render without a second call. Additive = non-breaking. |
| `Offer.deliverables` | `TEXT[]` | Array of strings. Matches. |
| `Thread.participantIds` | Join table | **Computed** — array of user IDs from `thread_participants`. Also return `participants: [UserMini]` additively. |
| `Thread.lastMessage` | FK `last_message_id` | Returns an **object** `{id, body, senderId, createdAt}`, not a string. ⚠️ If your frontend mock has it as a plain string, change the mock to an object — this is the one field where I'd fix the frontend rather than the API. |
| `Thread.unreadCount` | Not a column | **Computed per requesting user:** `COUNT(messages WHERE created_at > my last_read_at AND sender_id != me)`. |
| `Message.read` | Not a column | **Computed:** `message.created_at <= other_participant.last_read_at`. Keep the field name for frontend compat. |
| `*.id` | UUID | Serializes as a string. No frontend change. |
| `Ask.deadline` | `DATE` | Emits `"2026-10-15"` (date only), not a full timestamp. |
| all `createdAt` / `joinedAt` | TIMESTAMPTZ | Emits `"2026-09-21T08:00:00Z"`. |

### Envelope shapes — frontend service layer must match these

**Paginated list** (every list endpoint):
```json
{ "items": [...], "page": 1, "pageSize": 20, "total": 137, "totalPages": 7, "hasNext": true }
```
> Frontend action: `askService.getAsks()` should return `res.items` and expose `res.total` for pagination. Mock services should adopt this envelope **now**, in Phase 6 of the frontend, so nothing changes at swap time.

**Single resource:** the bare object. No `{data: ...}` wrapper.

**Error** (every 4xx/5xx):
```json
{ "error": { "code": "ASK_NOT_FOUND", "message": "Ask not found.", "details": null, "requestId": "..." } }
```

---

## 5. API route map

Base: `/api/v1`. 🔒 = requires access token.

### Auth
| Method | Path | Body / Query | Returns |
|---|---|---|---|
| POST | `/auth/signup` | name, email, password, roles | `{user, accessToken}` + refresh cookie |
| POST | `/auth/login` | email, password | `{user, accessToken}` + refresh cookie |
| POST | `/auth/refresh` | — (cookie) | `{accessToken}` |
| POST | `/auth/logout` 🔒 | — | `204` |
| GET | `/auth/me` 🔒 | — | `User` |

### Users
| Method | Path | Notes |
|---|---|---|
| GET | `/users/me` 🔒 | full own profile |
| PATCH | `/users/me` 🔒 | name, avatarUrl, bio, location, categories, roles |
| PATCH | `/users/me/password` 🔒 | currentPassword, newPassword |
| GET | `/users/{id}` 🔒 | public profile (no email) |
| GET | `/users/{id}/asks` 🔒 | paginated, public ASKs only |
| GET | `/users/{id}/offers` 🔒 | **owner only** |

### Asks
| Method | Path | Notes |
|---|---|---|
| GET | `/asks` 🔒 | filters: `q, category, status, minBudget, maxBudget, location, isRemote, requesterId, sort, page, pageSize` |
| POST | `/asks` 🔒 | seeker role required |
| GET | `/asks/{id}` 🔒 | includes `requester`, `responseCount` |
| PATCH | `/asks/{id}` 🔒 | **owner only**, blocked once `closed`/`cancelled` |
| DELETE | `/asks/{id}` 🔒 | **owner only**, soft delete |
| PATCH | `/asks/{id}/status` 🔒 | owner only, validated transition |
| GET | `/asks/me` 🔒 | shortcut for the dashboard |
| GET | `/asks/{id}/matches` 🔒 | Phase 10, stub returns `[]` |

`sort` values: `newest` (default), `oldest`, `budget_high`, `budget_low`, `deadline`.

### Offers
| Method | Path | Notes |
|---|---|---|
| GET | `/asks/{askId}/offers` 🔒 | **ASK owner** sees all; a provider sees only their own |
| POST | `/asks/{askId}/offers` 🔒 | provider role; 409 if already offered; 409 if ASK not `open` |
| GET | `/offers/me` 🔒 | provider dashboard, paginated |
| GET | `/offers/{id}` 🔒 | ASK owner or the offer's provider |
| PATCH | `/offers/{id}` 🔒 | **provider only**, only while `pending` |
| PATCH | `/offers/{id}/status` 🔒 | `{status}` — see rules below |
| DELETE | `/offers/{id}` 🔒 | provider only → `withdrawn` |
| GET | `/asks/{askId}/offers/compare?ids=a,b,c` 🔒 | ASK owner only, max 4 ids |

Status authority: `shortlisted`/`rejected`/`accepted` → **ASK owner only**. `withdrawn` → **provider only**.

### Threads & messages
| Method | Path | Notes |
|---|---|---|
| GET | `/threads` 🔒 | inbox; sorted `updated_at DESC`; includes `unreadCount`, `lastMessage` |
| POST | `/threads` 🔒 | `{participantId, askId?, offerId?}` — returns the existing thread if one already exists |
| GET | `/threads/{id}` 🔒 | participants only |
| GET | `/threads/{id}/messages` 🔒 | **cursor pagination** (`before`, `limit`) — not page numbers |
| POST | `/threads/{id}/messages` 🔒 | bumps `thread.updated_at`, sets `last_message_id`, notifies others |
| POST | `/threads/{id}/read` 🔒 | sets my `last_read_at = now()` |

### Notifications
| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` 🔒 | `?unreadOnly=true`, paginated |
| GET | `/notifications/unread-count` 🔒 | `{count}` for the bell badge |
| POST | `/notifications/{id}/read` 🔒 | |
| POST | `/notifications/read-all` 🔒 | |

### Uploads (Phase 8) & system
| Method | Path | Notes |
|---|---|---|
| POST | `/uploads` 🔒 | multipart → `{id, name, url, size, mimeType}` |
| DELETE | `/uploads/{id}` 🔒 | owner only |
| GET | `/health` | `{status, version}` — no auth |

---

## 6. Authentication strategy

**Access token** — JWT, HS256, **15 min**, sent as `Authorization: Bearer <token>`, stored in frontend **memory only** (never `localStorage`).
Claims: `sub` (user id), `roles`, `iat`, `exp`, `jti`, `type: "access"`.

**Refresh token** — opaque random 32 bytes, **7 days**, stored **hashed** in `refresh_tokens`, sent as an `httpOnly; Secure; SameSite=Lax` cookie. Rotated on every refresh; the old row is revoked immediately.

**Reuse detection:** if a refresh token that is already revoked is presented, revoke **every** token for that user and force re-login. Cheap, and it's the one thing that makes refresh tokens actually safer than a long-lived JWT.

**Password rules:** min 8 chars, must contain a letter and a digit, max 128. bcrypt, cost 12. Never log or return the hash.

**Dependencies in `core/deps.py`:**
- `get_db()` → yields a `Session`, closes it in `finally`
- `get_current_user()` → decodes the token, loads the user, 401 on failure
- `get_current_active_user()` → also checks `is_active`
- `require_roles(*roles)` → factory returning a dependency, 403 on mismatch
- `get_optional_user()` → for endpoints that behave differently when logged in

**Ownership is checked in the service layer, never in the route.** `ask_service.update(db, ask_id, payload, current_user)` raises `ForbiddenError` itself. Routes stay three lines long.

**CORS:** allow `http://localhost:5173` (Vite) and your deployed origin, `allow_credentials=True` (required for the refresh cookie). Never use `allow_origins=["*"]` with credentials — it silently fails.

---

## 7. Validation rules

| Entity | Field | Rule |
|---|---|---|
| User | name | 2–80 chars, trimmed, not blank |
| | email | valid, lowercased, unique → `409 EMAIL_TAKEN` |
| | password | 8–128, ≥1 letter, ≥1 digit |
| | roles | non-empty subset of enum; `admin` never self-assignable |
| | bio | ≤1000 |
| | categories | ≤10 items, each ≤40 chars |
| Ask | title | 10–140 |
| | description | 30–5000 |
| | category | must be in the allowed category list |
| | budgetMin/Max | ≥0, `max >= min`, both optional but if one is set both should be |
| | currency | ISO-4217, 3 uppercase letters |
| | deadline | today or later |
| | attachments | ≤5 items |
| Offer | price | ≥0, ≤10,000,000 |
| | deliveryDays | 1–365 |
| | pitch | 30–3000 |
| | deliverables | ≤10 items, each ≤120 chars |
| Message | body | 1–5000, not whitespace-only |
| Pagination | page | ≥1, default 1 |
| | pageSize | 1–100, default 20 |

Do field-shape validation in **Pydantic**. Do rules that need the database (uniqueness, ownership, state transitions) in the **service layer**. Never in the route.

---

## 8. Error handling

`app/core/exceptions.py`:

```python
class AppError(Exception):
    status_code = 500; code = "INTERNAL_ERROR"; message = "Something went wrong."

class NotFoundError(AppError):      status_code=404; code="NOT_FOUND"
class ValidationError(AppError):    status_code=422; code="VALIDATION_ERROR"
class UnauthorizedError(AppError):  status_code=401; code="UNAUTHORIZED"
class ForbiddenError(AppError):     status_code=403; code="FORBIDDEN"
class ConflictError(AppError):      status_code=409; code="CONFLICT"
class InvalidTransitionError(ConflictError): code="INVALID_STATUS_TRANSITION"
```

Three handlers registered in `main.py`:
1. `AppError` → the standard error envelope
2. `RequestValidationError` (Pydantic) → `422` with per-field `details: [{field, message}]`
3. `Exception` → log the traceback with the `requestId`, return a **generic** 500. Never leak a stack trace to the client.

Middleware attaches a `X-Request-ID` (uuid4) to every request and echoes it in the error body — this is what makes a user bug report actually debuggable.

**Codes the frontend should branch on:** `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `ASK_NOT_FOUND`, `ASK_NOT_OPEN`, `DUPLICATE_OFFER`, `NOT_ASK_OWNER`, `INVALID_STATUS_TRANSITION`, `VALIDATION_ERROR`.

---

## 9. Config & environment

`app/core/config.py` using `pydantic-settings` — **fail fast at startup if a required var is missing.**

```
.env.example
------------
ENV=development                  # development | test | production
DEBUG=true
API_V1_PREFIX=/api/v1

DATABASE_URL=postgresql+psycopg://uask:uask@localhost:5432/uask
TEST_DATABASE_URL=postgresql+psycopg://uask:uask@localhost:5432/uask_test

JWT_SECRET=change-me-openssl-rand-hex-32
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS=http://localhost:5173
COOKIE_SECURE=false              # true in production
COOKIE_DOMAIN=

UPLOAD_BACKEND=local             # local | supabase  (Phase 8)
UPLOAD_MAX_MB=10
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_BUCKET=uask-uploads
```

`.env` is gitignored. `.env.example` is committed with dummy values.

**Supabase note:** when you move the hosted DB to Supabase, only `DATABASE_URL` changes (use the **session pooler** URL on port `5432`, not the transaction pooler, because Alembic needs prepared statements). Everything else is identical — that's the payoff of keeping SQLAlchemy in front.

---

## 10. Migration strategy

1. `alembic init alembic`, point `env.py` at `Base.metadata` and read the URL from `Settings`.
2. Set a **naming convention** on `Base.metadata` *before* the first migration, or Alembic will generate unnamed constraints that you can't drop later:

```python
naming_convention = {
  "ix": "ix_%(table_name)s_%(column_0_name)s",
  "uq": "uq_%(table_name)s_%(column_0_name)s",
  "ck": "ck_%(table_name)s_%(constraint_name)s",
  "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
  "pk": "pk_%(table_name)s",
}
```
3. Enable extensions in the **first** migration: `CREATE EXTENSION IF NOT EXISTS pgcrypto;` and `citext;`
4. Create enum types explicitly in migrations (`sa.Enum(..., name="ask_status", create_type=True)`). Autogenerate handles enums badly — always review.
5. **Always read the generated migration before running it.** Autogenerate misses: enum value changes, column renames (it emits drop+add, which loses data), server defaults, and index changes.
6. One migration per logical change, message in imperative mood: `alembic revision --autogenerate -m "add offers table"`.
7. Never edit a migration that has run on a shared/hosted DB — write a new one.
8. Every migration needs a working `downgrade()`. Test it locally: `upgrade head` → `downgrade -1` → `upgrade head`.
9. Seed data lives in `scripts/seed.py`, **not** in migrations.

---

## 11. Testing strategy

**Tools:** `pytest`, `pytest-cov`, `httpx` + FastAPI `TestClient`, `factory-boy` or plain fixture functions.

**DB strategy:** a real `uask_test` Postgres database (SQLite will lie to you about arrays, JSONB, enums, and CITEXT). Each test runs inside a transaction that is **rolled back** in the fixture teardown — fast and perfectly isolated.

```
tests/conftest.py fixtures:
  db          → session bound to a rolled-back transaction
  client      → TestClient with get_db overridden to use `db`
  user / provider / admin → created users
  auth_client → client with a valid Bearer token attached
```

**What to test, in priority order:**
1. **Auth flows** — signup, duplicate email, login, wrong password, expired token, refresh rotation, reuse detection.
2. **Authorization** — for every mutating endpoint, assert a non-owner gets `403`. This is where real bugs live.
3. **State machines** — every invalid Ask/Offer transition returns `409`.
4. **The accept-offer transaction** — one accepted, all others rejected, ask closed, thread created, notifications emitted. Assert all five in one test.
5. **Pagination & filters** — envelope shape, `total` correctness, `pageSize` clamping.
6. **Serialization** — one snapshot test per entity asserting the JSON keys are **camelCase and exactly what the frontend expects**. This is your contract test; it catches drift instantly.

Target ≥80% coverage on `services/`. Don't chase coverage on routes or models.

---

## 12. Phased implementation roadmap

| # | Phase | Deliverable | Done when |
|---|---|---|---|
| 1 | **Skeleton** | Project structure, `config.py`, `db/session.py`, `main.py`, `/health`, CORS, Docker Compose Postgres, Alembic initialized | `GET /health` returns 200 and `alembic upgrade head` runs clean |
| 2 | **Core plumbing** | `enums.py`, `exceptions.py` + handlers, `CamelModel`, `pagination.py`, `base.py` repo, request-ID middleware | A deliberate error returns the exact error envelope |
| 3 | **Auth + User** | `users` + `refresh_tokens` models, migration, `security.py`, `deps.py`, all `/auth/*` and `/users/*` routes | Signup → login → `/auth/me` → refresh → logout works in Swagger |
| 4 | **Asks** | `asks` model, migration, repo/service/routes, filters, sorting, pagination, soft delete, status transitions | Full ASK CRUD + `GET /asks?category=&page=` returns the correct envelope |
| 5 | **Offers** | `offers` model, migration, repo/service/routes, duplicate guard, compare endpoint, **accept-offer transaction** | Accepting one offer rejects the rest and closes the ASK, in one transaction |
| 6 | **Notifications** | `notifications` model, service, routes; wire emit calls into ask/offer services | Creating an offer produces a notification for the ASK owner |
| 7 | **Messaging** | `threads`, `thread_participants`, `messages`; cursor pagination; unread logic; thread auto-created on offer accept | `unreadCount` and `read` compute correctly for both participants |
| 8 | **Uploads** | `attachments` table, `POST /uploads`, local disk backend behind an interface, Supabase Storage backend | An uploaded file returns a URL that renders in the frontend |
| 9 | **Hardening** | Full test suite, seed script, rate limiting on auth routes, structured logging, `README`, deploy to Render/Railway + Supabase | CI green, staging URL live, frontend pointed at it |
| 10 | **AI matching** | `matching_service.py`: keyword/category scoring first, embeddings later; `GET /asks/{id}/matches`, `ask_matched` notifications | Matches returns a ranked provider list with scores |

**Frontend swap point:** after **Phase 5**, your frontend's `authService`, `askService`, and `offerService` can be switched from mocks to `http.js`. Messaging and notifications stay mocked until Phases 6–7 land. That staged swap is exactly why the service-layer split matters.

---

## 13. Rules for whoever writes the code (you or OpenCode)

- Routes are thin: validate → call service → return. No `if` statements about business rules.
- Services never import FastAPI. Repositories never raise HTTP errors.
- Every response model inherits `CamelModel`. No exceptions.
- Every list endpoint returns the pagination envelope, even when it feels like overkill.
- Every FK gets an explicit `ondelete=`. Every migration is read before it runs.
- No `select *` into a Pydantic model without a `response_model` — that's how `password_hash` leaks.
- `Depends(get_current_user)` on every 🔒 route. Do not invent your own auth check.
- No new dependency without a reason written in the commit message.
