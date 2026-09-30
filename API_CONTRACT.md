# UASK — API Contract (frontend freeze checkpoint)

What the **current frontend** expects from a backend. Derived from `src/services/*` and `src/mocks/*` — each
service function below is the exact swap point; its signature and return shape are what pages already depend on.
Pages never call `mocks/` directly, so a backend only needs to replace service bodies.

Conventions
- JSON, **camelCase** field names, ISO-8601 UTC strings for all dates (`createdAt`, `deadline`, …).
- Money: integer amounts in the record's own `currency`. **INR is canonical**; stored values are never rewritten.
  Display conversion is frontend-only (static demo rates in `utils/formatCurrency.js`).
- IDs are opaque strings (mocks use `user-1`, `ask-1`, `offer-1`, `contract-1`, `thread-1`, `notification-1`,
  `milestone-<…>`, `conn-…`; signup currently uses `crypto.randomUUID()`).
- "Not found" is returned as `null` (single record) or `[]` (lists); errors should be thrown/rejected (pages show
  an error state on rejection).
- The HTTP paths below are **suggested** — the frontend has no HTTP layer yet (`services/http.js` not started).
  Only the service function names/signatures/shapes are binding.

## Product rules the backend must enforce
1. **Seeker can browse ASKs but cannot respond.** Only users whose *active role* is `provider` may create an offer.
2. **Provider can respond when eligible:** provider role, not the ASK's own requester, ASK `status === 'open'`, and
   no existing offer by that provider on that ASK (one response per provider per ASK).
3. **Matching ranks ONLY actual responders** to an ASK (offers already submitted). It never ranks the wider
   provider pool. (Provider-side "Recommended ASKs" is a separate, lightweight discovery list — see §5.)
4. **Connections are instant** — no pending/request/approval flow; no `pending` state exists.
5. **Connected users can access UASK chat.** (Frontend currently also lets a thread be opened via "Message"
   from a profile/Connections card; thread creation reuses any existing thread between two users.)
6. **Contact/social details (`linkedin`, `instagram`, `contactEmail`) are visible only to connected users** (or the
   owner). Never return them on general user payloads to non-connected viewers — see §2 `getContactDetails`.
7. **Default currency is INR.** Supported currencies: **INR, USD, EUR** (see Settings + Blockers for GBP note).
8. **Premium is currently "Coming Soon."** No real billing. New/any users are `plan: 'basic'`; checkout returns
   `status: 'requires_backend'` and must not grant Premium.
9. **Roles:** `roles` is an array of `'seeker' | 'provider'` (a user may have both). The UI also has a per-user
   *active role* (client-side switch, persisted locally under `uask.activeRole.<userId>`); responding/ASK-creating
   logic keys off the active role.

---

## 1. Auth

Client state: logged-in user object cached in localStorage `uask.auth.user`. Mock accepts **any password**.

| Service fn | Suggested endpoint | Request | Response |
|---|---|---|---|
| `login({ email })` | `POST /auth/login` | `{ email, password }` | `User` (+ token in real impl). Mock: matching seeded user, else creates a seeker. |
| `signup({ name, email, roles })` | `POST /auth/signup` | `{ name, email, password, roles: ['seeker'\|'provider', …] }` | `User` |
| `logout` | client-side today | — | — |

`User` (see §2). Errors: invalid credentials / email taken → reject.

## 2. Users / Profile

```
User {
  id, name, email,
  avatarUrl: string ('' if none),
  roles: ('seeker'|'provider')[],
  bio: string, location: string,
  categories: string[],        // category labels, e.g. 'Design'; provider skills, [] for seekers
  rating: number|null,         // seeded baseline, out of 5
  reviewCount: number,
  joinedAt: ISO,
  // optional, connected-only (see getContactDetails) — NOT part of the public payload:
  linkedin?, instagram?, contactEmail?
}
```

`headline` is **derived client-side** (`Provider`/`<Category> Provider`/`Seeker`) — not a stored field.

| Service fn | Endpoint | Request | Response |
|---|---|---|---|
| `getUserById(id)` | `GET /users/:id` | — | `User \| null` |
| `getAllUsers()` | `GET /users` | — | `User[]` (backs People search / Discover People) |
| `updateUser(id, data)` | `PATCH /users/:id` (self only) | partial `User` incl. `name, bio, location, categories, avatarUrl, linkedin, instagram, contactEmail` | updated `User \| null` |
| `getContactDetails(viewerId, targetId)` | `GET /users/:id/contact` | viewer from auth | `{ linkedin, instagram, contactEmail }` (strings, `''` if unset) **only if viewer is the owner or connected**; otherwise `null` |
| `getPortfolioForUser(userId)` | `GET /users/:id/portfolio` | — | `PortfolioItem[]` |
| `getProviderReputation(userId)` | `GET /users/:id/reputation` | — | `Reputation` (see §9) |
| `getCompletedContractsForProvider(userId)` | `GET /users/:id/completed-contracts` | — | `Contract[]` (completed, newest `completedAt` first) |
| saved providers: `getSavedProviderIds / isProviderSaved / saveProvider / unsaveProvider` | `GET/PUT/DELETE /me/saved-providers[/:providerId]` | — | `string[]` of provider ids (bookmark only; per-user; localStorage `uask.savedProviders.<userId>` today) |

```
PortfolioItem { id, userId, title, category, description, thumbnail: string ('' if none) }
```
Email format is validated client-side only if a contact email is provided.

## 3. ASKs

```
Ask {
  id, title, description,
  category: string,                 // label, see categories
  budgetMin: number, budgetMax: number, currency: 'INR'|'USD'|'EUR'|'GBP'(legacy),
  deadline: ISO, location: string, isRemote: boolean,
  status: 'open'|'matched'|'in_review'|'accepted'|'closed',
  attachments: { name: string }[],
  requesterId: string,
  responseCount: number,
  createdAt: ISO
}
```
Status enum values seen in data: `open, matched, in_review, accepted, closed`. Only `open` accepts responses;
`accepted` is set when an offer is accepted.

| Service fn | Endpoint | Request | Response |
|---|---|---|---|
| `getAsks(filters)` | `GET /asks` | query: `category` (label), `status`, `requesterId`, `isRemote` (bool), `location` (substring, ci), `budgetMin`/`budgetMax` (**INR**, range-overlap: `ask.budgetMax >= budgetMin`, `ask.budgetMin <= budgetMax`), `postedWithin` (`24h\|7d\|30d`), `search` (substring on title+description, ci), `sort` (`newest`(default)`\|oldest\|budget_high\|budget_low\|deadline_soon`) | `Ask[]` |
| `getCategories()` | `GET /categories` | — | `{ id, label, icon }[]` — current: Design, Writing, Development, Photography, Marketing, Tutoring, Events |
| `getAskById(id)` | `GET /asks/:id` | — | `Ask \| null` |
| `createAsk(data)` | `POST /asks` | `{ title, category, description, budgetMin, budgetMax, currency, deadline, location, isRemote, attachments, requesterId }` (server sets `id`, `status:'open'`, `responseCount:0`, `createdAt`; `requesterId` should come from auth) | created `Ask` |
| `updateAskStatus(id, status)` | `PATCH /asks/:id/status` | `{ status }` (requester only) | `Ask \| null` |
| `incrementResponseCount(id)` | — | **Should become server-side side effect of creating an offer**; frontend calls it right after `createOffer` | `Ask \| null` |

Discover's budget filter is entered in the user's preferred currency and converted to INR *before* querying, so
the API's `budgetMin/Max` filters are in **INR**. Note: frontend compares raw stored budgets against INR filter
values without per-ask currency conversion (see Blockers).

## 4. Offers / Responses

```
Offer {
  id, askId, providerId,
  price: number, currency, deliveryDays: number,
  pitch: string,                    // frontend composes "why you're a fit" + experience + portfolio links into this
  deliverables: string[],
  attachments: { name: string }[],
  status: 'pending'|'shortlisted'|'accepted'|'rejected',
  createdAt: ISO
}
```

| Service fn | Endpoint | Request | Response |
|---|---|---|---|
| `getOffersForAsk(askId)` | `GET /asks/:askId/offers` | — | `Offer[]` (visible to the ASK's requester; a provider sees at least their own) |
| `getOffersByIds(ids)` | `GET /offers?ids=a,b` | — | `Offer[]` |
| `getOffersByProviderId(providerId)` | `GET /offers?providerId=` | — | `Offer[]` |
| `createOffer(data)` | `POST /asks/:askId/offers` | `{ askId, providerId, price, currency, deliveryDays, pitch, deliverables, attachments }` (server defaults: `currency:'INR'`, `status:'pending'`, `createdAt`) | created `Offer`. **Must enforce rule 2** (provider, not owner, ASK open, no duplicate) |
| `updateOfferStatus(offerId, status)` | `PATCH /offers/:id/status` | `{ status: 'shortlisted'\|'accepted'\|'rejected' }` (ASK requester only) | `Offer \| null` |

Accepting: frontend calls `updateOfferStatus(…,'accepted')` → `updateAskStatus(askId,'accepted')` →
`createContract(…)` (§9) as three calls; a backend should do this atomically in one accept action.

## 5. Compare / Matching

Frontend implements a deterministic, rule-based scorer in `matchingService.js` (no ML). **Backend should take
over with the same shapes.**

`rankResponses(ask, offers, providers)` → `GET /asks/:askId/ranked-responses`  (requester only)

Ranks **only the ASK's existing offers**. Response:
```
RankedResponse[] (sorted by score desc) {
  offer: Offer,
  provider: User,
  score: number,               // integer 0–100
  label: 'Excellent Match'|'Strong Match'|'Relevant',   // ≥80 / ≥55 / else
  reasons: string[],           // ≤3 short strings
  rating: number|null,
  similarProjectCount: number,
  strength: 'Best value'|'Fastest delivery'|'Highest rated'|'Strongest portfolio fit'|null
}
```
Current weights (sum 100): category match 30, similar projects 25 (completed contracts + ≤2 portfolio items in
same category), rating 15, budget fit 10 (offer price vs ask range), timeline fit 10 (`deliveryDays` vs days
to `deadline`), Profile Booster 10. `strength` is relative within the compared batch.

`getRecommendedAsksForProvider(providerId, { limit = 6 })` → `GET /me/recommended-asks?limit=`
Provider-side discovery only (not ranking of responders): open ASKs the provider didn't create and hasn't
responded to. Response: `{ ask: Ask, score, label, reasons: string[] }[]` sorted by score desc.

## 6. Connections

Instant; record has no status field.
```
ConnectionRecord { id, fromUserId, toUserId, connectedAt: ISO }   // unordered pair, one per pair
```
| Service fn | Endpoint | Response |
|---|---|---|
| `getConnectionStatus(currentUserId, targetUserId)` | `GET /connections/status/:targetUserId` | `{ status: 'self'\|'none'\|'connected', connectionId: string\|null }` |
| `getConnectionCount(userId)` | `GET /users/:id/connections/count` | `number` |
| `getConnectionsForUser(userId)` | `GET /users/:id/connections` | `{ connectionId, userId (the other party), since: ISO }[]` newest first (page resolves users via `getUserById`) |
| `connectWithUser(fromUserId, toUserId)` | `POST /connections` `{ toUserId }` | `ConnectionRecord` (idempotent: returns existing) |
| `removeConnection(connectionId)` | `DELETE /connections/:id` | `boolean` |

## 7. Chat / Inbox

```
Thread  { id, participantIds: [userId, userId], askId: string|null, lastMessage: string, unreadCount: number (for the viewer), updatedAt: ISO }
Message { id, threadId, senderId, body, attachments: [], createdAt: ISO, read: boolean }
```
| Service fn | Endpoint | Request | Response |
|---|---|---|---|
| `getThreads(userId)` | `GET /threads` | — | `Thread[]` by `updatedAt` desc |
| `getOrCreateThread(a, b)` | `POST /threads` `{ userId }` | — | existing thread between the two users, else a new empty direct thread (`askId: null`) |
| `getThreadById(id)` | `GET /threads/:id` | — | `Thread \| null` |
| `getMessages(threadId)` | `GET /threads/:id/messages` | — | `Message[]` oldest first |
| `markThreadAsRead(threadId, userId)` | `POST /threads/:id/read` | — | `Thread \| null` (sets `unreadCount:0`, marks others' messages `read:true`) |
| `sendMessage({ threadId, senderId, body })` | `POST /threads/:id/messages` | `{ body }` | created `Message` (also updates thread `lastMessage`/`updatedAt`) |

No sockets/typing/presence; polling or refetch is acceptable for v1. `unreadCount` is a single number per thread
(mock data is not per-participant — backend should return it for the requesting user).

## 8. Notifications
```
Notification { id, userId, type, title, body, link: string (app route, e.g. '/app/asks/ask-1'), read: boolean, createdAt: ISO }
type ∈ 'offer_received' | 'offer_accepted' | 'offer_rejected' | 'offer_shortlisted' | 'ask_matched' | 'message'
```
| Service fn | Endpoint | Response |
|---|---|---|
| `getNotifications(userId)` | `GET /notifications` | `Notification[]` newest first |
| `markAsRead(id)` | `POST /notifications/:id/read` | `Notification \| null` |
| `markAllAsRead(userId)` | `POST /notifications/read-all` | `Notification[]` (the user's list, newest first) |

Mock notification `body` strings contain pre-formatted amounts (e.g. "₹36,000") — backend should keep bodies
currency-neutral or INR-formatted (they are not re-converted client-side).
Inbox unread badge = unread notifications + unread thread messages (computed client-side).

## 9. Contracts / Milestones / Payments

```
Contract {
  id, askId, offerId, seekerId, providerId,
  agreedPrice: number, currency,
  deliverables: string[],
  status: 'active' | 'completed',
  rating: number|null,          // out of 5, set once by seeker after completion
  review: string|null,
  createdAt: ISO, completedAt: ISO|null,
  milestones: Milestone[]
}
Milestone { id, title, description, amount: number, dueDate: ISO,
            status: 'upcoming'|'in_progress'|'submitted'|'approved'|'paid' }
```
Milestone flow: `upcoming/in_progress → submitted` (**provider** action) `→ approved` (**seeker**) `→ paid`
(**seeker**, mock payment). `paid` is the only terminal/settled state. Contract: `active` until the seeker marks
it completed; rating/review set once after completion.

| Service fn | Endpoint | Request | Response |
|---|---|---|---|
| `getContractsForUser(userId)` | `GET /contracts` | — | `Contract[]` (user is seeker or provider) |
| `getContractByAskId(askId)` | `GET /asks/:askId/contract` | — | `Contract \| null` |
| `createContract({ askId, offerId, seekerId, providerId, agreedPrice, currency, deliverables, deliveryDays })` | `POST /asks/:askId/contract` (ideally part of accept-offer) | as listed | `Contract` (idempotent per ask). Frontend builds ≤3 milestones from deliverables, amounts split evenly (remainder on last), `dueDate` spread across `deliveryDays`, all `upcoming` — backend should replicate or accept milestones explicitly |
| `updateMilestoneStatus(contractId, milestoneId, status)` | `PATCH /contracts/:id/milestones/:mid` | `{ status }` (role-gated per flow above) | updated `Contract \| null` |
| `markContractCompleted(contractId)` | `POST /contracts/:id/complete` | — | `Contract` (`status:'completed'`, `completedAt`) |
| `rateContract(contractId, { rating, review })` | `POST /contracts/:id/rating` | `{ rating: number(0–5), review?: string }` | `Contract` |
| `getProviderReputation(userId)` | `GET /users/:id/reputation` | — | see below |

```
Reputation {
  revenue: number,                   // sum of `paid` milestone amounts over provider's active+completed contracts (raw, treated as INR)
  averageRating: number|null,        // mean rating of completed+rated contracts, display "X.X / 5"
  reviewCount: number,
  completedContractCount: number,
  completedMilestoneCount: number,   // paid
  totalMilestoneCount: number,
  profileBoosterPct: number          // round(completedMilestoneCount / totalMilestoneCount * 20); 0 if no milestones
}
```

## 10. Search

Substring (case-insensitive) matching; empty/whitespace query → empty results.
| Service fn | Endpoint | Request | Response |
|---|---|---|---|
| `searchAsks(query, { limit })` | `GET /search/asks?q=&limit=` | matches title, description, category | `Ask[]` |
| `searchPeople(query, { limit, excludeUserId })` | `GET /search/people?q=&limit=` | matches name, derived headline, bio, location, categories (exclude the caller) | `User[]` |
| `searchAll(query, { limit, excludeUserId })` | `GET /search?q=&limit=` | — | `{ asks: Ask[], people: User[] }` |

## 11. Settings / Preferences

All currently **client-only localStorage** (JSON-encoded). Backend needs a per-user preferences record if these
should sync across devices:
```
Preferences {
  currency: 'INR'|'USD'|'EUR',       // default 'INR'            (uask.settings.currency)
  emailNotifications: boolean,        //                          (uask.settings.emailNotifications)
  productUpdates: boolean,            // default false            (uask.settings.productUpdates)
  theme: string,                      // appearance              (uask.theme.preference)
  activeRole: 'seeker'|'provider'     // per user                 (uask.activeRole.<userId>)
}
onboardingCompleted: boolean          // per user                 (uask.onboarding.completed.<userId>)
```
Suggested: `GET/PATCH /me/preferences`. Other client-only state that stays local: Create ASK draft
(`uask.draft.createAsk`), Respond drafts (`uask.draft.respond.<askId>`).

## 12. Premium status

Premium is **Coming Soon** in the UI (drawer shows the plan table blurred/inert; checkout unreachable).
```
Subscription { userId, plan: 'basic'|'premium', billingCycle: 'monthly'|'yearly'|null, upgradedAt: ISO|null }
```
| Service fn | Endpoint | Response |
|---|---|---|
| `getSubscription(userId)` | `GET /me/subscription` | `Subscription` (default `{ userId, plan:'basic', billingCycle:null, upgradedAt:null }`) |
| `upgradeToPremium(userId, billingCycle)` | `POST /me/subscription` (finalize **after** payment succeeds) | `Subscription` — not called from UI now |
| `createCheckoutSession(userId, billingCycle)` | `POST /checkout` | `{ id, userId, plan:'premium', billingCycle, amount, currency:'INR', status:'requires_backend', createdAt }` — pricing ₹149/month, ₹999/year; must not grant Premium |

The UI shows the upgrade teaser whenever `plan !== 'premium'`.

---

## Enum quick reference
- Role: `seeker | provider`
- Ask status: `open | matched | in_review | accepted | closed`
- Offer status: `pending | shortlisted | accepted | rejected`
- Contract status: `active | completed`
- Milestone status: `upcoming | in_progress | submitted | approved | paid`
- Connection status (derived): `self | none | connected`
- Notification type: `offer_received | offer_accepted | offer_rejected | offer_shortlisted | ask_matched | message`
- Match label: `Excellent Match | Strong Match | Relevant`
- Match strength: `Best value | Fastest delivery | Highest rated | Strongest portfolio fit`
- Subscription plan: `basic | premium`; billing cycle: `monthly | yearly`
- Currency: `INR | USD | EUR` (forms additionally allow legacy `GBP`)
- ASK filter `postedWithin`: `24h | 7d | 30d`; sort: `newest | oldest | budget_high | budget_low | deadline_soon`
