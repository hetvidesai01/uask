# UASK — Backend API Contract

> **Authoritative wire contract** of the UASK backend (branch `backend`), audited against the frozen
> frontend (branch `main` @ `def8b2f`, services in `src/services/*`) in the **Backend Phase 11
> frontend-compatibility audit**. Where this document and the older frontend freeze copy disagree,
> this document wins (frozen contract: `backend/AGENTS.md`). Every remaining adapter delta the
> frontend must implement is recorded in **Appendix A** — nothing else needs a backend change.

## 0. Conventions

- Base path: `/api/v1`. One FastAPI monolith; staging at `https://uask-backend-staging-sb2d.onrender.com`.
- JSON bodies and response keys are **camelCase** (`CamelModel`); Python/DB internals are `snake_case`.
- **IDs** are UUIDv4 serialized as strings.
- **Timestamps** are `TIMESTAMPTZ`, UTC, ISO-8601 with `Z` (e.g. `2026-10-19T09:03:18.569334Z`).
  ASK `deadline` is a **date** (`YYYY-MM-DD`), not a timestamp.
- **Money** is a number in the record's own `currency` (`INR` | `USD` | `EUR`, default `INR`,
  never rewritten or converted server-side).
- All responses (and error rejections) come from Pydantic schemas — additive fields may appear;
  **renames and removals are contract breaks and never happen**.

## 1. Envelope, pagination, errors

### 1.1 Pagination envelope

Every list endpoint returns:

```json
{ "items": [...], "page": 1, "pageSize": 20, "total": 0, "totalPages": 0, "hasNext": false }
```

**Documented bare-array exceptions** (limit-only discovery endpoints):

| Endpoint | Returns |
|---|---|
| `GET /asks/{askId}/ranked-responses` | bare `RankedResponse[]` |
| `GET /me/recommended-asks` | bare `Ask[]` |
| `GET /search/asks` | bare `Ask[]` |
| `GET /search/people` | bare `UserProfile[]` |
| `GET /search` | `{ asks: Ask[], people: UserProfile[] }` (grouped, never one mixed list) |

**Cursor pagination exception** — `GET /threads/{id}/messages` returns:

```json
{ "items": [Message], "nextCursor": "uuid|null", "hasMore": false, "limit": 50 }
```

(`nextCursor` = id of the oldest returned message when more history exists; pass it back as
`?before=`.)

### 1.2 Error envelope

All 4xx/5xx responses:

```json
{ "error": { "code": "SNAKE_CASE_CODE", "message": "Human sentence.", "details": null, "requestId": "…" } }
```

- `422 VALIDATION_ERROR` → `details` is `[{field, message}]`; echoed inputs are never returned.
- `500 INTERNAL_ERROR` → fixed generic message; stack traces are logged server-side per `requestId`.
- Rate limiting → `429 RATE_LIMITED` + `Retry-After`.

## 2. Auth

- `POST /auth/signup` (201) — body `{name, email, password, roles, termsAccepted, privacyAccepted}`.
  **Both acceptance flags must be `true`** or `422 VALIDATION_ERROR` ("Terms and Privacy Policy
  must be accepted to create an account."). `roles`: 1+ of `seeker|provider` (no `admin`).
- `POST /auth/login` (200) — `{email, password}`; `401 INVALID_CREDENTIALS`.
- Both return `AuthResponse` `{user: UserResponse, accessToken: string}` and set an **HttpOnly
  refresh cookie** (`refresh_token`, path `/`, rotated on every refresh).
- **Cookie flags:** `SameSite=None; Secure` whenever `COOKIE_SECURE=true` or the environment is
  production (cross-site frontends — Vercel app → Render API — only send cookies on credentialed
  requests when both hold); `SameSite=Lax` otherwise (local dev). `COOKIE_DOMAIN` optional.
- `POST /auth/refresh` (200, unauthenticated, reads the cookie) → `{accessToken}`.
- `POST /auth/logout` (204) — revokes the user's refresh tokens, clears the cookie.
- `GET /auth/me` (200) → `UserResponse` (own profile incl. `termsAccepted`/`termsVersion`/
  `privacyAccepted`/`privacyVersion`, contact fields, email).
- Access tokens are **Bearer JWTs** (`Authorization: Bearer <accessToken>`); the API is stateless
  per request except the refresh cookie. CORS allows `https://reversemarketplace-eight.vercel.app`
  and `http://localhost:5173` with credentials — no wildcard.

## 3. Rate limiting

Fixed-window, in-process. Buckets: `login`/`signup` 10/60s per IP, `refresh` 30/60s per IP,
`uploads` 60/60s per user, `messages` 120/60s per user. Over-limit → `429`. Off in tests.

## 4. Endpoint index

`auth` = requires Bearer access token.

| Method | Path | Auth |
|---|---|---|
| GET    | /api/v1/asks | auth |
| POST   | /api/v1/asks | auth |
| DELETE | /api/v1/asks/{ask_id} | auth |
| GET    | /api/v1/asks/{ask_id} | auth |
| PATCH  | /api/v1/asks/{ask_id} | auth |
| GET    | /api/v1/asks/{ask_id}/contract | auth |
| GET    | /api/v1/asks/{ask_id}/offers | auth |
| POST   | /api/v1/asks/{ask_id}/offers | auth |
| GET    | /api/v1/asks/{ask_id}/offers/compare | auth |
| GET    | /api/v1/asks/{ask_id}/ranked-responses | auth |
| PATCH  | /api/v1/asks/{ask_id}/status | auth |
| POST   | /api/v1/auth/login |  |
| POST   | /api/v1/auth/logout | auth |
| GET    | /api/v1/auth/me | auth |
| POST   | /api/v1/auth/refresh |  |
| POST   | /api/v1/auth/signup |  |
| POST   | /api/v1/connections | auth |
| GET    | /api/v1/connections/status/{target_user_id} | auth |
| DELETE | /api/v1/connections/{connection_id} | auth |
| GET    | /api/v1/contracts | auth |
| GET    | /api/v1/contracts/{contract_id} | auth |
| GET    | /api/v1/contracts/{contract_id}/amendments | auth |
| POST   | /api/v1/contracts/{contract_id}/amendments | auth |
| POST   | /api/v1/contracts/{contract_id}/amendments/{amendment_id}/approve | auth |
| POST   | /api/v1/contracts/{contract_id}/amendments/{amendment_id}/reject | auth |
| POST   | /api/v1/contracts/{contract_id}/amendments/{amendment_id}/withdraw | auth |
| POST   | /api/v1/contracts/{contract_id}/cancellation-request | auth |
| POST   | /api/v1/contracts/{contract_id}/cancellation-request/approve | auth |
| POST   | /api/v1/contracts/{contract_id}/cancellation-request/respond | auth |
| POST   | /api/v1/contracts/{contract_id}/complete | auth |
| GET    | /api/v1/contracts/{contract_id}/disputes | auth |
| POST   | /api/v1/contracts/{contract_id}/disputes | auth |
| POST   | /api/v1/contracts/{contract_id}/disputes/{dispute_id}/resolve | auth |
| GET    | /api/v1/contracts/{contract_id}/history | auth |
| PATCH  | /api/v1/contracts/{contract_id}/milestones/{milestone_id} | auth |
| POST   | /api/v1/contracts/{contract_id}/progress | auth |
| POST   | /api/v1/contracts/{contract_id}/progress/approve | auth |
| POST   | /api/v1/contracts/{contract_id}/progress/revision | auth |
| POST   | /api/v1/contracts/{contract_id}/rating | auth |
| POST   | /api/v1/contracts/{contract_id}/sign | auth |
| GET    | /api/v1/health |  |
| GET    | /api/v1/me/recommended-asks | auth |
| GET    | /api/v1/notifications | auth |
| PATCH  | /api/v1/notifications/read-all | auth |
| PATCH  | /api/v1/notifications/{notification_id}/read | auth |
| GET    | /api/v1/offers/{offer_id} | auth |
| PATCH  | /api/v1/offers/{offer_id} | auth |
| GET    | /api/v1/ready |  |
| GET    | /api/v1/search | auth |
| GET    | /api/v1/search/asks | auth |
| GET    | /api/v1/search/people | auth |
| GET    | /api/v1/threads | auth |
| POST   | /api/v1/threads | auth |
| GET    | /api/v1/threads/{thread_id} | auth |
| GET    | /api/v1/threads/{thread_id}/messages | auth |
| POST   | /api/v1/threads/{thread_id}/messages | auth |
| POST   | /api/v1/uploads | auth |
| DELETE | /api/v1/uploads/{upload_id} | auth |
| GET    | /api/v1/users/{user_id} | auth |
| PATCH  | /api/v1/users/{user_id} | auth |
| GET    | /api/v1/users/{user_id}/completed-contracts | auth |
| GET    | /api/v1/users/{user_id}/connections | auth |
| GET    | /api/v1/users/{user_id}/connections/count | auth |
| GET    | /api/v1/users/{user_id}/contact | auth |
| GET    | /api/v1/users/{user_id}/reputation | auth |

## 5. Users & profile

```
UserPublic   { id, name, avatarUrl, rating, reviewCount }
UserProfile  { id, name, avatarUrl, bio, location, categories[], roles[], rating, reviewCount, joinedAt }
UserResponse { …UserProfile base fields…, id, email, isActive, joinedAt, updatedAt,
               linkedin, instagram, contactEmail, termsAccepted, termsVersion,
               privacyAccepted, privacyVersion }
ContactDetails { linkedin, instagram, contactEmail }
```

- `rating` (0–5, 1 dp) and `reviewCount` are **derived** from rated completed contracts — never
  writable. `headline` does **not exist server-side** (frontend derives it client-side).
- `GET /users/{id}` → `UserProfile` (no email, no contact fields). 404 `USER_NOT_FOUND`.
- `PATCH /users/{id}` (owner or admin) → `UserResponse`; accepts partial
  `{name, avatarUrl, bio, location, categories, roles, linkedin, instagram, contactEmail}`.
  Legal-acceptance timestamps are system-managed and not writable.
- `GET /users/{id}/contact` → `ContactDetails` for the **owner or a connection** only;
  otherwise `403 NOT_CONNECTED`.
- `GET /users/{id}/connections` → envelope of `Connection` items (see §9), newest first.
- `GET /users/{id}/connections/count` → `{count}`.
- `GET /users/{id}/reputation` → see §13. `GET /users/{id}/completed-contracts` → envelope.
- **There is no `GET /users` list endpoint** (privacy). People discovery = `GET /search/people`.

## 6. ASKs

```
Ask { id, title, description, category, budgetMin, budgetMax, currency,
      deadline (date|null), location, isRemote, status,
      attachments[] , requesterId, responseCount, createdAt, updatedAt,
      deletedAt (null), requester (UserPublic|null) }
```

- `category` is validated against the canonical label set (case-insensitive match, canonical
  label stored — `Design`, `Writing`, `Development`, `Photography`, `Marketing`, `Tutoring`,
  `Events`).
- `attachments` is free-form (`[{name}]` is fine). `budgetMin`/`budgetMax` both-or-neither;
  `budgetMax >= budgetMin`. `responseCount` is **server-derived** (live offers count) — clients
  never increment it.

**`GET /asks`** (envelope) query params:
`q` (substring on title+description, ci), `category`, `status`, `minBudget`, `maxBudget`
(range-overlap: excludes ASKs with a null bound on the filtered side), `location` (substring ci),
`isRemote`, `requesterId`, `postedWithin` (`24h|7d|30d`), `sort`
(`newest`(default)|`oldest|budget_low|budget_high|deadline`), `page`, `pageSize` (≤100).

**`POST /asks`** (seeker role, 201) — body per `AskCreate`; server sets `status:'open'`,
`responseCount:0`, timestamps. `requesterId` comes from auth; client-supplied ids are ignored.

**`PATCH /asks/{id}`** (owner) — partial `AskUpdate`; `403 NOT_ASK_OWNER`; `accepted`/`closed`/
`cancelled` ASKs are immutable → `409 ASK_NOT_EDITABLE`. Soft-deleted → `404`.

**`PATCH /asks/{id}/status`** (owner, new in Phase 11) — `{status}`. Only terminal owner
transitions: `open|matched|in_review → closed|cancelled` and `accepted → closed` (an accepted
ASK has a live contract — its cancellation goes through the contract flow). Same-status →
idempotent 200; any other transition → `409 ASK_NOT_EDITABLE`; non-owner → `403 NOT_ASK_OWNER`.

**`DELETE /asks/{id}`** (owner) → 204 soft delete (`deletedAt` stamped; excluded from lists).

Offers on an ASK: `GET/POST /asks/{id}/offers`, comparison `GET /asks/{id}/offers/compare`,
owner-only ranking `GET /asks/{id}/ranked-responses` (§8), owner-only contract
`GET /asks/{id}/contract` (404 when none).

## 7. Offers

```
Offer { id, askId, providerId, price, currency, deliveryDays,
        pitch, deliverables[], attachments[], status,
        createdAt, updatedAt, deletedAt (null) }
```

- `pitch` 30–3000 chars; `price` 0–10,000,000; `deliveryDays` 1–365; `currency` default `INR`.
- Statuses: `pending | shortlisted | accepted | rejected | withdrawn`
  (`withdrawn` is backend-only; the frozen frontend set is the first four).
- `POST /asks/{id}/offers` — provider role, not the ASK owner, ASK `open`, one live offer per
  provider per ASK; violations → `403`/`409 ASK_NOT_OPEN`/`409 OFFER_EXISTS`. `providerId` is
  derived from auth; extra client fields (e.g. `askId`, `providerId`) are ignored.
- `PATCH /offers/{id}` — `{status: shortlisted|accepted|rejected}` by the ASK requester only.
  **`accepted` runs the atomic accept transaction**: offer accepted, competitors rejected, ASK →
  `accepted`, thread created (or reused), **contract `draft` + three 25/50/25 payment stages
  minted**, notifications emitted. `GET /offers/{id}` → any participant.

## 8. Matching

**`GET /asks/{id}/ranked-responses?limit=`** — ASK owner only (`403 NOT_ASK_OWNER`). Bare
`RankedResponse[]`:

```
RankedResponse { offer: Offer, provider: UserPublic, score (0–100 int),
                 label: 'Excellent Match'|'Strong Match'|'Relevant',
                 reasons[] (≤3, favorable only), rating,
                 similarProjectCount (int|null — null when no real data, never faked),
                 strength: 'Best value'|'Fastest delivery'|'Highest rated'|'Strongest portfolio fit'|null }
```

Weights (sum 100): category 30, similar projects 25, rating/reviews 15, budget fit 10, timeline
fit 10, profile completeness 10 (unknown signals score neutral 50). Labels: ≥80 / ≥55 / else.
Strengths only when ≥2 responses and the holder is unique. Sort: score desc → rating desc →
price asc → createdAt asc → offer id. Read-only — never writes statuses.

**`GET /me/recommended-asks?limit=6`** (provider role) — bare `Ask[]`: open ASKs in the
provider's own categories, excluding their own ASKs and ASKs they already answered, newest
first. **No scores server-side** — scoring stays client-side (see Appendix A.2).

## 9. Connections

Instant; no pending state; one row per unordered pair.

```
Connection { id, connectedUserId, connectedUser (UserPublic|null), createdAt,
             connectionId (= id), userId (= connectedUserId), since (= createdAt) }
```

(`connectionId`/`userId`/`since` are **additive aliases** consumed by the frontend service.)

- `POST /connections {toUserId}` → 201 first time / 200 idempotent repeat. `422 SELF_CONNECTION`,
  `404 USER_NOT_FOUND`. Extra client fields (e.g. `fromUserId`) are ignored.
- `GET /connections/status/{targetUserId}` → `{status: self|none|connected, connectionId}`.
- `DELETE /connections/{id}` → 204, participants only.
- `GET /users/{id}/connections` → envelope, newest first.

## 10. Chat (threads & messages)

```
Thread { id, askId (null for direct), ask (ThreadAskRef|null), offerId,
         participantIds[], participants (UserPublic[]),
         lastMessage {id, body, senderId, createdAt}|null,
         unreadCount (viewer's), createdAt, updatedAt }
Message { id, threadId, senderId, body, attachments[], read, createdAt, sender (UserPublic|null) }
```

- `POST /threads {participantId}` — connected pair only (`403 NOT_CONNECTED`, `422 SELF_THREAD`,
  `404 USER_NOT_FOUND`) → 201 new / 200 existing (one direct thread per pair is reused, including
  accept-created threads).
- `GET /threads` → envelope, newest `updatedAt` first, with per-viewer `unreadCount`.
- `GET /threads/{id}` → `Thread`. `GET /threads/{id}/messages?before=&limit=` → cursor `MessagePage`
  (newest-first page; older history via `nextCursor`).
- **Reading = marking read:** fetching messages advances the viewer's `lastReadAt`, so
  `unreadCount` clears on open. Sending a message also updates `lastMessage`/`updatedAt` and
  notifies the other side (`message` notification). There is **no** separate mark-read endpoint.
- `POST /threads/{id}/messages {body, attachments?}` → 201 `Message`.

## 11. Notifications

```
Notification { id, userId, type, title, body, link, read, createdAt }
```

- Types (canonical wire values): `offer_received | offer_shortlisted | offer_accepted |
  offer_rejected | ask_matched | message` (+ backend-only `ask_closing_soon`, `system`).
- `GET /notifications?unreadOnly=&page=&pageSize=` → envelope, newest first.
- `PATCH /notifications/{id}/read` → 200 `Notification`.
- `PATCH /notifications/read-all` → **204, no body** (refetch the list to render updated state).

## 12. Contracts (frozen workflow)

Prototype model: **no gateway, no escrow, no refunds — every "payment" is a status label.**
Seeker = "ASK side", provider = "Respond side". Full rules: `backend/AGENTS.md` frozen rows.

```
Contract { id, askId, offerId, seekerId, providerId, agreedPrice, currency,
           scope, deliverables[], finalDeadline, includedRevisionCount, revisionsUsed,
           ownershipOption: transfers_after_final_payment|custom,
           portfolioPermission: allowed|not_allowed|ask_before_using,
           confidentialityAgreed, termsVersion,
           status: draft|awaiting_signatures|active|completed|cancelled|disputed,
           askSideSignedAt, respondSideSignedAt, projectProgress: 0|25|60|100,
           contractEditCount, calculatedEditFee, projectValue, platformFee, providerCommission,
           cancellationRequested, cancellationReason, cancellationRequestedAt,
           cancellationProgressSnapshot, cancellationTerminationEstimatePct,
           hasOpenDispute, completedAt, rating, review, createdAt, updatedAt,
           milestones[3], ... }
PaymentStage { id, contractId, kind: initial|progress|final, title, description,
               amount, dueDate, status: not_due|due|awaiting_approval|paid|disputed,
               paidAt (nullable, server-stamped once, immutable) }
```

- **Mint:** created inside the accept transaction as `draft` with a frozen terms snapshot — one
  contract per accepted ASK, never client-created.
- **Sign** `POST /contracts/{id}/sign` — signer derived from auth; each side signs only itself;
  idempotent; first → `awaiting_signatures`, second → `active` + initial stage `due`.
- **Progress** `POST /contracts/{id}/progress {progress: 60|100}` — respond side only; 60% needs
  initial paid, 100% needs 60% approved (`409 PROGRESS_NOT_DUE`/`PROGRESS_ALREADY_SUBMITTED`).
  `POST …/progress/approve` (ask side) moves `awaiting_approval → due` and advances
  `projectProgress`; `POST …/progress/revision` (ask side) bumps `revisionsUsed` and resets the
  submission (`409 REVISIONS_EXHAUSTED` when out). `projectProgress` is derived server-side only.
- **Stages** `PATCH /contracts/{id}/milestones/{mid} {status:'paid'}` — ask side only, only from
  `due`, terminal once paid, frozen when the contract leaves `active` (`409` family). `paidAt`
  stamped exactly once by the server; never client-writable.
- **Amendments** `POST /contracts/{id}/amendments {changes, reason?}` — amendable terms only
  (price/currency frozen → 422); other participant approves/rejects/…; proposer may withdraw;
  pre-activation approval resets both signatures (history `signatures_reset`); edit fees are
  informational (2 free, 2.5%/edit, 7.5% cap → `calculatedEditFee`); locked after
  `projectProgress ≥ 60` except during an open dispute.
- **Disputes** `POST /contracts/{id}/disputes {reason, description?}` — reasons
  `scope_mismatch|missed_deadline|communication_issue|payment_disagreement|
  revision_disagreement|other`; contract + live stage → `disputed`; resolve endpoint returns the
  contract to `active` when none remain. No winner, no money movement.
- **Cancellation** `POST /contracts/{id}/cancellation-request {reason}` — records only.
  `POST …/respond {decision: approve|decline|withdraw}` (approve/decline = other participant,
  withdraw = requester; legacy `…/approve` = alias). Nothing is terminated or charged.
- **Completion/rating** `POST /contracts/{id}/complete` — ask side, `active` + final stage paid.
  `POST /contracts/{id}/rating {rating, review?}` — ask side, completed only, set once; rating
  0–5 at 1 dp; recomputes the provider's derived rating/reputation.
- **History** `GET /contracts/{id}/history` → envelope of
  `{id, contractId, actorId, action, details, createdAt}` (oldest first), participants only.
- `GET /contracts` → envelope (either side, newest first); `GET /asks/{id}/contract` and
  `GET /contracts/{id}` → participants only.

## 13. Reputation & completed contracts

- `GET /users/{id}/reputation` → `{revenue, averageRating, reviewCount, completedContractCount,
  completedMilestoneCount, totalMilestoneCount, profileBoosterPct}` — all derived from the
  user's own contracts (paid-milestone revenue, 1 dp half-up mean rating, booster
  `round(paid/total × 20)`, max 20).
- `GET /users/{id}/completed-contracts` → envelope of safe subsets
  `{id, askId, askTitle, agreedPrice, currency, status, completedAt, rating, review}`, newest
  `completedAt` first, either role.

## 14. Search

- `GET /search/asks?q=&limit=` → bare `Ask[]`; `GET /search/people?q=&limit=` → bare
  `UserProfile[]`; `GET /search?q=&limit=` → `{asks, people}`.
- Fields — ASKs: title, description, category. People: name, bio, location, categories
  (**not `headline`** — client-derived). Case-insensitive substring; term trimmed; empty →
  empty result. `limit` 1–50, default 10; `q` ≤ 200 chars.
- Deterministic relevance ladder (exact → prefix → substring → …) then newest, then id. People
  exclude the caller and inactive users. No email/contact fields ever.

## 15. Uploads & storage

- `POST /uploads` (multipart) → 201 `{id, name, url, size, mimeType}`; optional bound
  `entityType` (`ask|offer|message`; for `message` the id is the **thread** id) + `entityId`,
  both-or-neither, with authorization checked **before any byte is written**. Allowlist:
  `image/png|jpeg|webp`, `application/pdf` (declared type + extension + magic bytes must agree);
  size ≤ `UPLOAD_MAX_MB`. Public URLs (local `/media/{key}` or Supabase
  `/storage/v1/object/public/{bucket}/{key}`) — no signed URLs, so stored links keep working.
- `DELETE /uploads/{id}` → 204, uploader only; storage object deleted first, then the DB row
  (storage failure → `502 STORAGE_ERROR`, row intact, retryable).
- `GET /ready` reports `storage: ok|error` without leaking details.

## 16. Health & readiness

- `GET /health` → exactly `{status: "ok", version}` — never touches dependencies.
- `GET /ready` → 200 `{status:"ready", version, checks:{database, storage}}` or 503 with
  `status:"unavailable"`; checks are only `"ok"`/`"error"`.
- Production hides `/docs`, `/redoc`, `/openapi.json` unless `ENABLE_DOCS=true`.

## 17. Enum quick reference

- Role: `seeker | provider` (backend also has `admin`, never signable-up)
- Ask status: `open | matched | in_review | accepted | closed | cancelled`
- Offer status: `pending | shortlisted | accepted | rejected | withdrawn`
- Contract status: `draft | awaiting_signatures | active | completed | cancelled | disputed`
- Payment-stage status: `not_due | due | awaiting_approval | paid | disputed`
- Stage kind: `initial | progress | final`; `projectProgress`: `0 | 25 | 60 | 100`
- Amendment status: `pending | approved | rejected | withdrawn`
- Dispute reason: `scope_mismatch | missed_deadline | communication_issue | payment_disagreement | revision_disagreement | other`
- Cancellation decision: `approve | decline | withdraw`
- Connection status (derived): `self | none | connected`
- Notification type: `offer_received | offer_shortlisted | offer_accepted | offer_rejected | ask_matched | message` (+ `ask_closing_soon`, `system`)
- Match label: `Excellent Match | Strong Match | Relevant`; strength: `Best value | Fastest delivery | Highest rated | Strongest portfolio fit`
- Currency: `INR | USD | EUR`; ASK `postedWithin`: `24h | 7d | 30d`; ASK sort: `newest | oldest | budget_low | budget_high | deadline`

---

# Appendix A — Frontend integration map (Phase 11 audit outcome)

Audited: 12 service files (~45 functions) + 10 mocks against the routes/schemas above.
The frontend is still **100% mock-driven** (no `fetch`, no HTTP layer anywhere in `src/`), so
everything below is what the eventual `src/services/http.js` adapter must implement. The
**service function signatures and return shapes stay as-is** (per the freeze) — the adapter
translates.

## A.1 Backend fixes landed in this audit

| Fix | Detail |
|---|---|
| Cross-site refresh cookie | `SameSite=None; Secure` when `COOKIE_SECURE`/production so the Vercel origin can do credentialed refresh; `Lax` in dev. |
| ASK status endpoint | `PATCH /asks/{id}/status` wired (the `AskStatusUpdate` schema existed but was dead) — powers `updateAskStatus(id, status)`. |
| `postedWithin` filter | `GET /asks?postedWithin=24h\|7d\|30d` — the time-window chip in `getAsks(filters)`. |
| Connection list aliases | items now carry `connectionId`/`userId`/`since` (additive) alongside `id`/`connectedUserId`/`createdAt`. |

## A.2 Required frontend changes (adapter / UI)

1. **Auth payloads** — `login` must send `{email, password}`; `signup` must send
   `{name, email, password, roles, termsAccepted: true, privacyAccepted: true}` (backend
   rejects otherwise). Store `accessToken` from the response, send
   `Authorization: Bearer …` on every call, call `POST /auth/refresh` with
   `credentials: 'include'` on 401, then retry; `logout` → 204.
2. **Unwrap the pagination envelope** — every list service reads `res.items` (asks,
   notifications, connections, contracts, amendments, disputes, history, completed contracts,
   threads). The four bare-array search/matching endpoints and `{asks, people}` are already
   bare. Messages use the cursor page `{items, nextCursor, hasMore}`.
3. **Dates** — `Ask.deadline` arrives as `YYYY-MM-DD` (send `date.slice(0,10)` on create);
   everything else is ISO-`Z`.
4. **ASKs** — map filter names: `search→q`, `budgetMin→minBudget`, `budgetMax→maxBudget`
   (overlap semantics; ASKs with a null bound on the filtered side are excluded),
   `sort: deadline_soon→deadline`. `responseCount` is server-derived — drop the client-side
   `incrementResponseCount` call. `updateAskStatus` maps to `PATCH /asks/{id}/status` with
   targets limited to `closed`/`cancelled` (plus `accepted→closed`).
5. **Offers** — `createOffer`: don't send `askId`/`providerId` (server derives; extras are
   ignored); enforce `pitch` ≥ 30 chars in the form. `updateOfferStatus(id, 'accepted')` runs
   the whole accept transaction server-side — **remove the follow-up client calls**
   (`updateAskStatus(…,'accepted')`, `createContract(…)`); then fetch the contract via
   `GET /asks/{askId}/contract`. `getOffersByIds`/`getOffersByProviderId` have no bulk endpoint —
   compose client-side or drop.
6. **Contracts** — field-rename map (frontend → backend):
   `progressPercent→projectProgress`, `deadline→finalDeadline`,
   `revisionsIncluded→includedRevisionCount`, `ownership→ownershipOption`
   (`transfer_on_final_payment→transfers_after_final_payment`), `portfolioPermission.ask_first→ask_before_using`,
   `confidentiality→confidentialityAgreed`, `fees{clientPlatformFeePct,freelancerCommissionPct}→platformFee/providerCommission`,
   `editCount→contractEditCount`, `editFeesTotal→calculatedEditFee`,
   `signatures{seeker,provider}→askSideSignedAt/respondSideSignedAt`,
   `pendingChange→amendments[]` (list, not single), `dispute→disputes[]`/`hasOpenDispute`,
   `history {actor,at}→{actorId,createdAt}`, `milestones[].stage→kind`,
   `updateProgress(0|25|60|100)→POST progress {60|100}` (0/25 are server-derived states, never
   PATCHed), `submitStage/reviewStage→progress + progress/approve + progress/revision`,
   `markStagePaid→PATCH …/milestones/{id} {status:'paid'}`,
   cancellation decision `accept→approve`, `respondToChange→amendments/{id}/approve|reject|withdraw`,
   `raiseDispute.reason` free-text labels → the six enum values,
   `markContractCompleted` requires final stage `paid` + `active`, `rateContract` is
   **ask-side only** and set-once. `createContract` (client minting) must be removed.
7. **Threads/messages** — `lastMessage` is an object `{id, body, senderId, createdAt}` (render
   `.body`); `markThreadAsRead` = just fetch messages (reading marks read server-side); opening
   a thread refreshes `unreadCount` on the next `GET /threads`.
8. **Notifications** — `markAllAsRead` gets a 204: refetch the list afterwards; switch type
   handling to the canonical wire values (§11).
9. **Matching** — `ranked-responses` matches the frozen shape (owner-only). For
   `getRecommendedAsksForProvider`, the backend returns **bare `Ask[]`** (frozen contract): keep
   the `{ask, score, label, reasons}` service shape by scoring client-side over that list.
10. **Search** — wire `searchAsks/searchPeople/searchAll` to `/search/*` instead of
    `getAsks({})` + client filtering (the current client-side pass also misses anything beyond
    the first 100 asks); `q` term, `limit` 1–50. `headline` is not a server field — accept that
    headline terms don't match server-side.

## A.3 Frontend-only by design (no backend exists, none planned yet)

- `getAllUsers` (no user-directory endpoint — use `/search/people`), portfolio
  (`getPortfolioForUser`), saved providers (localStorage bookmark), subscriptions/premium
  (`getSubscription`/`upgradeToPremium`/`createCheckoutSession` — premium/payments are a future
  product rule), settings/preferences (§11 of the freeze doc), `getCategories` (client-side
  labels). Mock-only status vocabularies (`upcoming|in_progress|submitted|approved`) are an
  internal detail — display states map to the backend stage statuses in §17.
