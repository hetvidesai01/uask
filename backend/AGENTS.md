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
- **Phase 10 — AI matching (not started):** no embedding/ML model, no `GET /asks/{id}/matches`. Contract responder ranking exists (see Phase 3) but directory-wide AI matching does not.
- **Backend Contract Alignment — Phase 1 (done):** ASK `accepted` state, canonical notification names, `lastMessage` object, pagination envelope, currency set. Migration `70311ae197b1`. Contract checks live in `tests/api/test_contract_alignment.py`.
- **Backend Contract Alignment — Phase 2 (done):** instant connections (`connections` table, no pending state), connected-user chat via `POST /threads`, private contact/social fields (`linkedin`, `instagram`, `contactEmail`) with owner-or-connection read access. Migration `810496335b61`. Contract checks live in `tests/api/test_connections.py` + `tests/api/test_contact_privacy.py`.
- **Backend Contract Alignment — Phase 3 (done):** deterministic responder ranking in `app/services/matching_service.py` behind `GET /asks/{askId}/ranked-responses` (owner-only) and `GET /me/recommended-asks?limit=6` (provider role). No migration — no new tables or columns. Contract checks live in `tests/api/test_ranking.py`, scoring rules in `tests/unit/test_matching_scoring.py`.
- **Backend Contract Alignment — Phase 4 (done):** `contracts` + `milestones` tables (`app/models/contract.py`, service `app/services/contract_service.py`), contract minted inside the accept transaction, role-gated milestone workflow, seeker completion + set-once rating, provider reputation/history. Migration `b5c8f2a41d90`. Contract checks live in `tests/api/test_contracts.py`, milestone generation in `tests/unit/test_contract_milestones.py`. Note: `API_CONTRACT.md` does not exist in this repo — the frozen rows below plus the Phase 4 spec message are the contract.
- **Backend Contract Alignment — Phase 5 (done):** Global Search — `GET /search/asks`, `GET /search/people`, `GET /search` (`app/api/v1/routes/search.py`, `app/services/search_service.py`, `app/repositories/search_repo.py`, schema `app/schemas/search.py`). No migration. Contract checks live in `tests/api/test_search.py`.

**Rules:**

- Do **not** rebuild or re-commit completed phases.
- Do **not** invent a different folder layout than the blueprint.
- Migrations live in `backend/alembic/versions/` (not `migrations/`). Never edit an applied migration — add a new one.
- Do **not** start a later phase (preferences, premium/payments, deployment) without being asked.

**Next phase:** awaiting instruction. Read the frozen contract section below before touching frontend-facing behavior.

## Frozen frontend contract — source of truth

Decided in Backend Contract Alignment Phase 1. The frontend contract wins over the blueprint where they disagree.

| Area | Decision |
|---|---|
| ASK lifecycle | `open`, `matched`, `in_review`, `accepted`, `closed`, plus backend-only `cancelled` (kept, never removed). Accepting an offer sets **`accepted`** — a provider was chosen and work may proceed. `closed` is reserved for finished work. |
| Offer eligibility | Only `open` ASKs accept new offers; anything else → 409 `ASK_NOT_OPEN`. |
| Accepted ASK edits | An `accepted` ASK is immutable, like `closed`/`cancelled` → 409 `ASK_NOT_EDITABLE`. |
| Accept transaction | One atomic transaction: offer accepted, competing offers rejected, ASK → `accepted`, thread created, **contract + initial milestones created**, notifications emitted. Never split into separate commits. |
| Notification types | Canonical on the wire: `offer_received`, `offer_shortlisted`, `offer_accepted`, `offer_rejected`, `ask_matched`, `message`. The API emits these directly — no per-service mapping layer. `ask_closing_soon` and `system` remain as extra backend values. |
| Thread shape | `lastMessage` is an object `{id, body, senderId, createdAt}` or `null`, never a string. The frontend service adapter normalizes/uses this object at integration time. |
| Pagination | `{items, page, pageSize, total, totalPages, hasNext}` on every list endpoint. Never a bare array. Adapters unwrap `items`. |
| Currency | `INR`, `USD`, `EUR`, default `INR`. Generic ISO-4217 3-letter validation stays; no new currencies this phase. |
| Connections | Instant — one `connections` row per unordered pair (`user_a_id < user_b_id`), no pending/approval state. `POST /connections {toUserId}` → 201 first time, 200 on repeat (same id). `GET /connections/status/{targetUserId}` → `{status: self\|none\|connected, connectionId}`. `DELETE /connections/{id}` → 204, participants only. |
| Connected chat | `POST /threads {participantId}` opens a direct chat for a connected pair only (403 `NOT_CONNECTED`, 422 `SELF_THREAD`, 404 `USER_NOT_FOUND`) → 201 new / 200 existing thread. One thread per pair is reused, including accept-created threads: on acceptance an existing unbound direct thread is bound to the ASK/offer instead of duplicating. |
| Contact privacy | `linkedin`, `instagram`, `contactEmail` are writable only through `PATCH /users/{id}` (owner/admin) and readable only via `GET /users/{id}/contact` by the owner or a connection — everyone else gets 403 `NOT_CONNECTED`. They never appear in `UserProfile` (`GET /users/{id}`) or `UserPublic` embeddings. |
| Ranked responses | `GET /asks/{askId}/ranked-responses` → bare `RankedResponse[]` for the **ASK owner only** (403 `NOT_ASK_OWNER`, 404 `ASK_NOT_FOUND`, 401). **Bare-array exception:** the contract specifies `[]` plus `?limit=`, so this endpoint skips the pagination envelope (documented deviation). Only offers actually submitted to that ASK are ranked. Deterministic weights (total 100): category relevance 30, similar projects 25, rating/reviews 15, budget fit 10, timeline fit 10, profile completeness 10. Signals that do not exist yet score a neutral 50 and `similarProjectCount` is reported as `null` — never faked. Labels: ≥80 `Excellent Match`, ≥55 `Strong Match`, else `Relevant` (half-up rounding). `reasons` ≤3, favorable factors only. `strength` superlatives (`Best value`, `Fastest delivery`, `Highest rated`, `Strongest portfolio fit`) only when ≥2 responses and only for the unique holder. Sort: score desc → rating desc → price asc → createdAt asc → offer id. Read-only: never selects a winner, writes no statuses, emits no notifications. |
| Recommended ASKs | `GET /me/recommended-asks?limit=6` (`limit` 1–50) → bare `Ask[]`: open ASKs whose category matches the provider's own categories, excluding the provider's own ASKs and ASKs they already answered; newest first. 403 `FORBIDDEN` for non-provider roles, 401 unauthenticated, `[]` when the provider has no categories. Discovery only — never auto-responds. |
| Contracts | Created **inside the accept transaction** — exactly one contract per accepted ASK (unique `ask_id` + `offer_id`; creation is idempotent). Fields: `id, askId, offerId, seekerId, providerId, agreedPrice, currency, deliverables, status, rating, review, createdAt, completedAt, milestones`. Statuses `active` → `completed` (`completed` never reverts). `GET /contracts` → envelope of the user's contracts (seeker or provider side, newest first). `GET /asks/{askId}/contract` → participants only (404 `CONTRACT_NOT_FOUND`, 403 `NOT_CONTRACT_PARTICIPANT`, 401). Currency/price are copied verbatim from the accepted offer — no FX. |
| Milestones | Generated at accept: ≤3, one per unique offer deliverable (fallback single `Project delivery`), even money split with the remainder on the final milestone, due dates spread across `deliveryDays`. Fields: `id, contractId, title, description, amount, dueDate, status`. `PATCH /contracts/{id}/milestones/{milestoneId}` `{status}` — provider moves `upcoming → in_progress → submitted` (may submit straight from `upcoming`); seeker moves `submitted → approved → paid` (only `submitted → approved`, `approved → paid`). **`paid` is terminal**; wrong role → 403 `PROVIDER_ONLY`/`SEEKER_ONLY`; bad jump or any write from `paid` → 409 `INVALID_STATUS_TRANSITION`; non-participant → 403 `NOT_CONTRACT_PARTICIPANT`; frozen once the contract is `completed` → 409 `CONTRACT_NOT_ACTIVE`. `paid` is a **mock payment state** — no gateway. |
| Completion + rating | `POST /contracts/{id}/complete` — seeker only (403 `SEEKER_ONLY`), sets `status=completed` + `completedAt`; second call → 409 `CONTRACT_NOT_ACTIVE`. Completion does **not** touch ASK/offer status. `POST /contracts/{id}/rating` `{rating, review?}` — seeker only, only on a completed contract (409 `CONTRACT_NOT_COMPLETED`), **set once** (repeat → 409 `ALREADY_RATED`), rating `0–5` at 1 decimal (422 out of range), review ≤1000 chars and optional. Never touches ASK state; provider cannot rate through this endpoint. |
| Reputation + history | `GET /users/{id}/reputation` (auth required, 404 `USER_NOT_FOUND`) → `{revenue, averageRating, reviewCount, completedContractCount, completedMilestoneCount, totalMilestoneCount, profileBoosterPct}` — all derived from the provider's own contracts: revenue = sum of `paid` milestone amounts (2-dp float, same currency, no FX), averageRating = mean of rated completed contracts (1 dp, half-up, 0 when unrated), completedContractCount = completed contracts as provider, milestone counts over the provider's milestones, `profileBoosterPct = round(completedMilestoneCount / totalMilestoneCount * 20)` with **half-up rounding** (matches JS `Math.round`), `0` when no milestones (max 20). `GET /users/{id}/completed-contracts` → envelope, newest `completedAt` first, safe subset `{id, askId, askTitle, agreedPrice, currency, status, completedAt, rating, review}` (no emails/contacts), contracts where the user participates in either role. `users.rating`/`users.reviewCount` stay **derived** — recomputed from rated completed contracts on each rating; `PATCH /users/{id}` has no rating fields (writes are ignored). |
| Global Search | `GET /search/asks?q=&limit=` → bare `Ask[]`; `GET /search/people?q=&limit=` → bare `UserProfile[]`; `GET /search?q=&limit=` → `{asks: Ask[], people: User[]}` with groups kept separate, never one mixed list. All three require the current authenticated user (401) and follow `GET /asks` visibility: soft-deleted ASKs excluded, no status filtering. **Fields searched** — ASKs: `title`, `description`, `category`; people: `name`, `bio`, `location`, `categories` — case-insensitive substring (ILIKE `%q%`), term trimmed, empty/whitespace/missing term → empty result without querying. Deterministic relevance ladder, then newest first, then id: ASKs title exact → title prefix → title substring → category → description-only; people name exact → name prefix → name substring → categories → location → bio-only. `q` ≤200 chars (422), `limit` default **10**, range **1–50** (422 outside). People results exclude the caller and inactive users; serialization reuses `AskResponse`/`UserProfile` (no email, no `linkedin`/`instagram`/`contactEmail` — those stay behind the contact-privacy rule). **Bare-array exception:** `/search/asks` and `/search/people` are limit-only discovery endpoints like ranked responses and recommended ASKs, so they skip the envelope (documented deviation); combined returns the specified `{asks, people}` shape. Plain ILIKE only — no fuzzy matching, no external service; the `ix_asks_fts` GIN index is deliberately unused because full-text loses substring/prefix matching and cannot cover `category`. |

### Future product rules — preserve, do not implement yet

- **Provider-directory matching (`GET /asks/{id}/matches`) ranks the whole directory** — still not implemented. Phase 3 ranks only the actual responders to an ASK, never the directory.
- **Connected users may start or reuse the UASK chat thread** for that ASK.

Not built yet: preferences, premium/payments (real gateways), Supabase uploads, deployment, provider-directory matches. Known gap: `scripts/seed.py` still writes accepted offers directly, so seeded demo data has **no** contract rows (the truncate list already covers the new tables).

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
