# UASK — Frontend Blueprint

**Stack:** React + Vite + React Router + plain CSS (CSS Modules)
**Core flow:** ASK → MATCH → RESPOND → COMPARE → CONNECT

## Assumptions made

- One account can act as **both** seeker and provider. Role is a UI toggle stored in auth state, not a separate login.
- No TypeScript, no Tailwind, no Redux. Context + local state only.
- All data is mock/local until Phase 9. No backend needed to finish the whole UI.
- Styling = **CSS Modules** (`Button.module.css`) + one global token file. Vite supports this with zero config, and it prevents class-name collisions without you learning a new syntax.

---

## 1. Route map

| Route | Screen | Access | Notes |
|---|---|---|---|
| `/` | Landing | Public | Marketing page, hero + flow explainer |
| `/login` | Login | Public | Redirects to `/app` if already logged in |
| `/signup` | Signup | Public | Role picked here (seeker / provider / both) |
| `/app` | — | Protected | Redirects to `/app/dashboard` |
| `/app/dashboard` | Dashboard | Protected | My ASKs, my offers, activity |
| `/app/asks/new` | Create ASK | Protected | Multi-step form |
| `/app/discover` | Discover ASKs | Protected | Provider view: browse + filter open ASKs |
| `/app/asks/:askId` | ASK details | Protected | Seeker sees responses; provider sees "Respond" CTA |
| `/app/asks/:askId/respond` | Provider response flow | Protected | Multi-step offer form |
| `/app/asks/:askId/compare` | Compare responses | Protected | Seeker only. Side-by-side table |
| `/app/messages` | Messages list | Protected | Thread list |
| `/app/messages/:threadId` | Message thread | Protected | Nested inside messages layout |
| `/app/notifications` | Notifications | Protected | |
| `/app/profile` | My profile | Protected | Edit own profile |
| `/app/profile/:userId` | Public profile | Protected | Provider profile seen by seekers |
| `*` | 404 | Public | |

**Router setup:** two layout routes.

```
<Routes>
  PublicLayout   →  /, /login, /signup
  ProtectedRoute →  AppLayout → all /app/* routes
  NotFound       →  *
</Routes>
```

`ProtectedRoute` = a component that checks `useAuth()`, renders `<Outlet />` if logged in, else `<Navigate to="/login" />`.

---

## 2. Page structure

### Landing (`/`)
Sections top to bottom:
1. **Navbar** — logo, "How it works", "Browse ASKs", Login, Sign up (primary red button)
2. **Hero** — Garamond H1, tagline in `--pink-tagline`, two CTAs: "Post an ASK" / "Respond to ASKs"
3. **Flow strip** — 5 numbered cards: ASK → MATCH → RESPOND → COMPARE → CONNECT
4. **Two-column value props** — "For seekers" / "For providers"
5. **Sample ASK cards** — 3 `AskCard`s from mock data (reuses the real component)
6. **Categories grid**
7. **Final CTA band** — deep red background, white text
8. **Footer**

### App shell (all `/app/*`)
- Top bar: logo, global search, role toggle, notification bell (badge), avatar menu
- Left sidebar (desktop) / bottom tab bar (mobile): Dashboard, Discover, Messages, Notifications, Profile
- Floating/primary "+ New ASK" button
- `<Outlet />` for page content inside a `PageContainer`

### Dashboard
Stat row (4 `StatCard`s) → tabs: **My ASKs** | **My Offers** | **Recent activity** → list of `AskCard` / `OfferCard` → `EmptyState` when nothing.

### Create ASK — 4 steps (single page, step state in component)
1. What do you need (title, category, description)
2. Details (budget range, timeline/deadline, location, remote toggle)
3. Attachments + optional requirements
4. Review & publish

Keep a persistent `StepIndicator` + Back/Next footer. Save draft to `localStorage`.

### Discover ASKs
Filter sidebar (category, budget, location, date, status) + sort dropdown + results grid of `AskCard` + pagination or "Load more". Filter state lives in URL search params (`useSearchParams`) so links are shareable.

### ASK details
Header (title, status badge, category, posted date) → requester mini-profile → full description → meta grid (budget, deadline, location) → attachments → **then role-dependent block**:
- Seeker + owner: responses list + "Compare all" button
- Provider: "Submit a response" CTA (or "You already responded" state)

### Provider response flow — 3 steps
1. Your offer (price, delivery timeline, what's included)
2. Why you're a fit (pitch, portfolio links, attachments)
3. Review & submit

### Compare responses
Sticky-header comparison table: rows = criteria (price, timeline, rating, deliverables, availability), columns = offers (max 4 selected). Mobile fallback = stacked `OfferCard`s. Actions per column: Message, Shortlist, Accept.

### Messages
Two-pane: `ThreadList` (left) + thread view (right). On mobile, list and thread are separate screens driven by `:threadId`.

### Notifications
Grouped by Today / This week / Earlier. Each row = icon + text + timestamp + unread dot. "Mark all read".

### Profile
Header (avatar, name, role badges, rating) → About → Skills/categories → Portfolio → Reviews. Edit mode toggles inputs on the same layout.

---

## 3. Folder structure

```
uask-frontend/
├─ index.html
├─ vite.config.js
├─ public/
└─ src/
   ├─ main.jsx
   ├─ App.jsx                    # router tree only
   ├─ styles/
   │  ├─ tokens.css              # CSS variables (colors, spacing, type)
   │  ├─ reset.css
   │  ├─ base.css                # html/body/heading defaults
   │  └─ utilities.css           # .container, .stack, .row, .sr-only
   ├─ layouts/
   │  ├─ PublicLayout.jsx
   │  ├─ AppLayout.jsx
   │  └─ ProtectedRoute.jsx
   ├─ pages/
   │  ├─ Landing/
   │  ├─ Login/
   │  ├─ Signup/
   │  ├─ Dashboard/
   │  ├─ CreateAsk/
   │  ├─ DiscoverAsks/
   │  ├─ AskDetails/
   │  ├─ RespondToAsk/
   │  ├─ CompareResponses/
   │  ├─ Messages/
   │  ├─ Notifications/
   │  ├─ Profile/
   │  └─ NotFound/
   ├─ components/
   │  ├─ ui/                     # generic, no business logic
   │  ├─ layout/                 # Navbar, Sidebar, Footer, PageHeader
   │  ├─ ask/                    # AskCard, AskFilters, AskStatusBadge...
   │  ├─ offer/                  # OfferCard, OfferForm, CompareTable
   │  ├─ messages/
   │  └─ notifications/
   ├─ context/
   │  ├─ AuthContext.jsx
   │  └─ ToastContext.jsx
   ├─ hooks/
   │  ├─ useAuth.js
   │  ├─ useToast.js
   │  ├─ useLocalStorage.js
   │  └─ useDebounce.js
   ├─ services/                  # the ONLY place that "fetches" data
   │  ├─ http.js                 # fetch wrapper (used from Phase 9)
   │  ├─ authService.js
   │  ├─ askService.js
   │  ├─ offerService.js
   │  ├─ messageService.js
   │  └─ notificationService.js
   ├─ mocks/
   │  ├─ users.js
   │  ├─ asks.js
   │  ├─ offers.js
   │  ├─ messages.js
   │  ├─ notifications.js
   │  └─ categories.js
   └─ utils/
      ├─ formatDate.js
      ├─ formatCurrency.js
      └─ validators.js
```

**Page folder convention:** each page is `PageName/index.jsx` + `PageName.module.css`, plus any page-only sub-components in the same folder.

**Component folder convention:** `Button/index.jsx` + `Button.module.css`.

---

## 4. Reusable components

### `components/ui/` — generic, reused everywhere
| Component | Props (key ones) |
|---|---|
| `Button` | `variant` (primary/secondary/ghost/danger), `size`, `loading`, `fullWidth`, `as` |
| `Input` | `label`, `error`, `hint`, `icon` |
| `Textarea` | `label`, `maxLength`, `error` |
| `Select` | `label`, `options`, `error` |
| `Checkbox` / `Radio` / `Toggle` | `label`, `checked` |
| `Card` | `padding`, `hoverable` |
| `Badge` | `variant` (open/closed/pending/accepted), `children` |
| `Tag` | `children`, `onRemove` |
| `Avatar` | `src`, `name` (initials fallback), `size` |
| `Modal` | `open`, `onClose`, `title` |
| `Drawer` | mobile filters |
| `Tabs` | `items`, `active`, `onChange` |
| `Spinner` | `size` |
| `Skeleton` | `width`, `height` — loading placeholders |
| `EmptyState` | `icon`, `title`, `message`, `action` |
| `Pagination` | `page`, `totalPages`, `onChange` |
| `Toast` | driven by `ToastContext` |
| `Rating` | `value`, `count`, `readOnly` |
| `StatCard` | `label`, `value`, `delta` |
| `FileUpload` | `files`, `onChange` (UI only until backend) |
| `StepIndicator` | `steps`, `current` |
| `SearchBar` | `value`, `onChange`, `placeholder` |

### `components/layout/`
`Navbar` (public), `AppTopBar`, `Sidebar`, `MobileTabBar`, `Footer`, `PageHeader` (title + subtitle + actions), `Container`.

### Domain components
| Component | Used in |
|---|---|
| `AskCard` | Landing, Dashboard, Discover, Profile |
| `AskList` | Dashboard, Discover |
| `AskFilters` | Discover (+ Drawer on mobile) |
| `AskStatusBadge` | AskCard, AskDetails, Dashboard |
| `AskMetaGrid` | AskDetails |
| `AskFormStep1..4` | CreateAsk |
| `OfferCard` | AskDetails, Dashboard, Compare (mobile) |
| `OfferList` | AskDetails |
| `OfferFormStep1..3` | RespondToAsk |
| `CompareTable` | CompareResponses |
| `UserMiniCard` | AskDetails, OfferCard, Messages |
| `ThreadList` / `ThreadListItem` | Messages |
| `MessageBubble` | Messages |
| `MessageComposer` | Messages |
| `NotificationItem` | Notifications + bell dropdown |
| `CategoryChipGrid` | Landing, CreateAsk, Discover |

### Shared across the most pages (build these first)
`Button`, `Input`, `Card`, `Badge`, `Avatar`, `EmptyState`, `Spinner`, `PageHeader`, `AskCard`, `OfferCard`, `UserMiniCard`.

---

## 5. Design system

### `styles/tokens.css`

```css
:root {
  /* Brand */
  --c-red:          #D02727;   /* primary actions, links, accents */
  --c-red-deep:     #992E34;   /* hover/pressed, secondary emphasis */
  --c-red-dark:     #6E1414;   /* dark bands, heading accent, footer */
  --c-pink:         #F7B4B4;   /* soft surfaces, tags, borders */
  --c-pink-tagline: #F0B8B8;   /* tagline text only */

  /* Neutrals */
  --c-bg:        #FDFCFB;
  --c-surface:   #FFFFFF;
  --c-surface-2: #F6F3F2;
  --c-text:      #1A1A1A;
  --c-text-mute: #5C5C5C;
  --c-border:    #E7E2E0;

  /* Status */
  --c-success: #2E7D57;
  --c-warning: #B8860B;
  --c-info:    #2B6CB0;
  --c-danger:  var(--c-red-dark);

  /* Type */
  --font-display: 'EB Garamond', Garamond, 'Times New Roman', serif;
  --font-body: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --fs-xs: 0.75rem;  --fs-sm: 0.875rem; --fs-base: 1rem;
  --fs-lg: 1.125rem; --fs-xl: 1.25rem;  --fs-2xl: 1.5rem;
  --fs-3xl: 2rem;    --fs-4xl: 2.75rem; --fs-5xl: 3.5rem;
  --lh-tight: 1.15;  --lh-normal: 1.55;

  /* Space (4px scale) */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px; --sp-8: 64px; --sp-9: 96px;

  /* Radius / shadow / layout */
  --r-sm: 4px; --r-md: 8px; --r-lg: 12px; --r-full: 999px;
  --sh-sm: 0 1px 2px rgba(26,26,26,.06);
  --sh-md: 0 4px 12px rgba(26,26,26,.08);
  --sh-lg: 0 12px 32px rgba(110,20,20,.12);
  --container: 1180px;
  --topbar-h: 64px;
  --sidebar-w: 240px;
}
```

Breakpoints (write mobile-first, only `min-width` queries): `640px`, `900px`, `1200px`.

### Typography rules
- `--font-display` **only** on: landing H1, section H2s, and page hero titles. Everything else uses `--font-body`.
- Load EB Garamond from Google Fonts — plain `Garamond` is not installed on most Windows/Linux machines, so relying on it alone will silently fall back to Times.

### Button variants
| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| primary | `--c-red` | white | none | `--c-red-deep` |
| secondary | transparent | `--c-red-deep` | 1px `--c-red-deep` | `--c-pink` bg |
| ghost | transparent | `--c-text` | none | `--c-surface-2` |
| danger | transparent | `--c-red-dark` | 1px `--c-red-dark` | `--c-red-dark` bg / white text |

**Risk to watch:** your brand colour is red, which is also the universal "destructive" colour. Don't rely on colour alone for delete actions — always pair with an explicit word ("Delete ASK") and a confirm `Modal`.

### Status badge colours
`open` → green, `matched` → info blue, `in_review` → warning, `closed` → grey, `accepted` → `--c-red-deep` on `--c-pink`.

### Accessibility floor
- `#D02727` on white = ~4.8:1 → fine for text ≥16px and buttons.
- `--c-pink` and `--c-pink-tagline` are **background/decoration only** — never body text on white.
- Every input needs a `<label>`; every icon-only button needs `aria-label`; visible `:focus-visible` outline in `--c-red-deep`.

---

## 6. Data shapes (mock now, API contract later)

```js
User   { id, name, email, avatarUrl, roles:['seeker','provider'], bio,
         location, categories:[], rating, reviewCount, joinedAt }

Ask    { id, title, description, category, budgetMin, budgetMax, currency,
         deadline, location, isRemote, status, attachments:[],
         requesterId, responseCount, createdAt }

Offer  { id, askId, providerId, price, currency, deliveryDays, pitch,
         deliverables:[], attachments:[], status:'pending'|'shortlisted'|'accepted'|'rejected',
         createdAt }

Thread { id, participantIds:[], askId, lastMessage, unreadCount, updatedAt }

Message{ id, threadId, senderId, body, attachments:[], createdAt, read }

Notification { id, userId, type, title, body, link, read, createdAt }
```

---

## 7. Mock data vs. backend

**The rule:** pages and components **never** import from `mocks/`. They only call `services/`. Services read from `mocks/` now and call `http.js` later. Swapping to a real backend then touches ~5 files, not 40.

```js
// services/askService.js  (Phase 2 version)
import { asks } from '../mocks/asks';
const delay = (ms=400) => new Promise(r => setTimeout(r, ms));

export async function getAsks(filters = {}) {
  await delay();
  return asks.filter(/* ...apply filters... */);
}
```

```js
// services/askService.js  (Phase 9 version — same export signature)
import { http } from './http';
export async function getAsks(filters = {}) {
  return http.get('/asks', { params: filters });
}
```

| Area | Phase 1–8 (mock) | Phase 9+ (API) |
|---|---|---|
| Auth | fake user in `localStorage`, any password works | `POST /auth/login`, `/auth/signup`, JWT in memory + refresh |
| ASK list / filters | filter the mock array in JS | `GET /asks?category=&min=&max=&page=` |
| ASK details | find by id | `GET /asks/:id` |
| Create ASK | push to array + toast | `POST /asks` |
| Offers | mock array keyed by askId | `GET /asks/:id/offers`, `POST /asks/:id/offers` |
| Compare | filter mock offers | `GET /asks/:id/offers?ids=` |
| Accept offer | mutate status locally | `PATCH /offers/:id` |
| Messages | mock threads, optimistic local append | `GET /threads`, `POST /threads/:id/messages` (+ websocket later) |
| Notifications | mock array | `GET /notifications`, `PATCH /notifications/read` |
| Profile | mock user, edit in state | `GET/PATCH /users/:id` |
| File upload | show filename chips only, no real upload | `POST /uploads` → store returned URL |
| Search | client-side `includes()` | server-side query param |

**Never mock:** routing, form validation, loading/empty/error states, responsive layout. Build those for real from day one — they're the parts that actually break later.

---

## 8. Build order

Do these strictly in order. Each phase should end with the app still running.

| # | Phase | What you ship |
|---|---|---|
| 1 | **Setup** | `npm create vite@latest` (React), install `react-router-dom`, add `styles/tokens.css` + reset + base, wire fonts, set up folder skeleton |
| 2 | **Routing + layouts** | `App.jsx` route tree, `PublicLayout`, `AppLayout`, `ProtectedRoute`, `NotFound`. Every page = a placeholder `<h1>`. Click every link and confirm it navigates. |
| 3 | **UI kit** | `Button, Input, Textarea, Select, Card, Badge, Avatar, Spinner, EmptyState, Modal, Tabs, Tag, StatCard`. Build a temporary `/styleguide` route rendering all of them in every variant. |
| 4 | **Landing page** | Full landing with all 8 sections, responsive. First real visual payoff. |
| 5 | **Auth screens** | Login + Signup with validation, `AuthContext`, fake login persisted to `localStorage`, redirect logic both ways. |
| 6 | **Mocks + services** | Write all `mocks/*` files and all `services/*` with `delay()`. No UI work this phase. |
| 7 | **Core loop** | Dashboard → Create ASK → Discover → ASK Details → Respond → Compare. This is the product. Build `AskCard` and `OfferCard` here and reuse them everywhere. |
| 8 | **Secondary screens** | Messages, Notifications, Profile. |
| 9 | **Polish** | Loading skeletons, empty states, error boundaries, toasts, mobile pass at 375px, keyboard/focus pass, remove `/styleguide`. |
| 10 | **API swap** | Add `http.js`, rewrite service bodies one file at a time, add real token handling, handle 401 → logout. |

**Phase 7 sub-order** (within the core loop): Discover (read-only list) → ASK Details (read-only) → Create ASK (first write) → Respond (second write) → Compare (depends on both) → Dashboard (aggregates everything).

---

## 9. Using this with Claude Code

Give it this file, then work **one phase per session**:

> "Read `UASK_FRONTEND_BLUEPRINT.md`. Implement Phase 3 only — the `components/ui/` kit plus a temporary `/styleguide` route. Use CSS Modules and the tokens in `styles/tokens.css`. Don't touch any page outside `pages/Styleguide`. Stop when done and list what you created."

Rules to give it up front:
- CSS Modules only; no inline styles, no hard-coded hex values — always `var(--c-*)`.
- Components in `components/` import nothing from `pages/`.
- Pages import data only from `services/`, never from `mocks/`.
- Every list view must handle three states: loading, empty, error.
- Mobile-first CSS; `min-width` media queries only.
