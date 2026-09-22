# UASK — Frontend

Full spec lives in `UASK_FRONTEND_BLUEPRINT.md`. Read that first for anything not covered here — this file is the quick-context summary, that file is the source of truth for detailed specs (route map, component prop tables, exact token values, build order).

## What UASK is

A **reverse marketplace**: users post what they need (an "ASK") and relevant providers respond with offers, instead of searching a catalog of listings.

**Core flow:** `ASK → MATCH → RESPOND → COMPARE → CONNECT`

## Scope

**Frontend only, for now.** No backend, no database, no real API. All data is mock (`src/mocks/`) served through a service layer (`src/services/`) with artificial delays, designed to be swapped for real HTTP calls later without touching any page code.

## Tech stack

- React + Vite
- React Router (client-side routing, `BrowserRouter`)
- Plain CSS with **CSS Modules** (`Component.module.css`)

**Explicitly not used** unless the user asks for it later: Tailwind, TypeScript, Redux, a backend, a database.

## Design system — source of truth

`src/styles/tokens.css` defines every brand color, font, spacing, radius, and shadow as a CSS custom property (`--c-*`, `--font-*`, `--fs-*`, `--sp-*`, `--r-*`, `--sh-*`). **Never hard-code a hex value or px number in a component — always reference a token.**

- Brand red (`--c-red` / `--c-red-deep` / `--c-red-dark`) is used *strategically* (primary actions, accents, dark bands) — not as a wash over everything.
- `--c-pink` / `--c-pink-tagline` are decoration/background only, never body text on a light background (fails contrast) — see how the landing hero kicker uses pink as a pill *background* with dark text instead.
- `--font-display` (EB Garamond) is reserved for the landing H1, section H2s, and hero-style titles. Everything else — body copy, nav, buttons, form labels, auth page headings — uses `--font-body`.
- Breakpoints are mobile-first, `min-width` only: `640px`, `900px`, `1200px`.
- Global utility classes live in `src/styles/utilities.css`: `.container`, `.stack`, `.row`, `.section` (consistent vertical rhythm), `.reveal`/`.isVisible` (scroll-reveal transition), `.sr-only`.

**Design tools are inspiration only.** UI/UX Pro Max, frontend-design, 21st.dev, etc. may be used to improve layout, hierarchy, spacing, accessibility, interaction, and motion — but must never replace UASK's brand colors, typography direction, tokens, or the product structure defined in the blueprint. If a tool suggests a different palette/font/design system, ignore that part and keep only the layout/interaction/technique idea, reskinned with existing tokens.

**Motion:** subtle and purposeful only — a short mount reveal on the hero, a one-time scroll reveal per section (via `src/hooks/useInView.js` + the `.reveal` utility), restrained hover states. Nothing gratuitous. Respects `prefers-reduced-motion` globally (`src/styles/base.css`).

**Mobile-first, accessible by default:**
- Every input has a real `<label>`; every icon-only control has an `aria-label`.
- Visible `:focus-visible` ring everywhere (don't remove without replacing).
- Touch targets sized comfortably (buttons have per-size `min-height`).
- Modal has a real focus trap + focus restore; Tabs support arrow-key navigation.

## Architecture rules

- **Pages/components never import from `mocks/`.** Only files in `src/services/` may import from `src/mocks/`. Pages call `services/*Service.js` functions, which internally read/filter the mock arrays (and later, will call a real API) with the same function signature either way.
- **Components don't import from `pages/`.** Data flows one direction: `pages/` → `services/` → `mocks/` (mock era) or `services/` → `http.js` → API (post-Phase-9).
- Reusable UI atoms live in `components/ui/` (13 built in Phase 3: Button, Input, Textarea, Select, Card, Badge, Avatar, Spinner, EmptyState, Modal, Tabs, Tag, StatCard). Public-site chrome lives in `components/layout/` (Navbar, Footer). App-shell chrome (sidebar nav on desktop, top bar + bottom tab bar + floating "+ New ASK" on mobile) was built directly into `layouts/AppLayout.jsx` in Phase 9 — a standalone `PageHeader` component is the one piece of the original blueprint shell still not built. Domain components (AskCard, OfferCard, ThreadList, NotificationItem, etc.) live in `components/ask/`, `components/offer/`, `components/messages/`, `components/notifications/`.
- Page folder convention: `PageName/index.jsx` + `PageName.module.css`, plus any page-local sub-components in the same folder (see `pages/Landing/` for the pattern with multiple section files).

## Folder structure (current)

```
src/
├─ main.jsx, App.jsx (route tree only), index.css
├─ styles/            tokens.css, reset.css, base.css, utilities.css
├─ layouts/            PublicLayout, AppLayout (full app-shell nav chrome), ProtectedRoute
├─ pages/              one folder per route (see App.jsx for the route map)
├─ components/
│  ├─ ui/              generic, reusable, no business logic
│  ├─ layout/           Navbar, Footer (public site only)
│  ├─ ask/              AskCard, AskFilters, AskFormStep1-4, AskMetaGrid, AskStatusBadge, UserMiniCard
│  ├─ offer/            OfferCard, OfferFormStep1-3, OfferList, OfferStatusBadge
│  ├─ messages/         ThreadList, ThreadListItem, MessageBubble, MessageComposer
│  └─ notifications/    NotificationItem
├─ context/            AuthContext.jsx, ToastContext.jsx
├─ hooks/              useAuth, useToast, useLocalStorage, useInView
├─ services/           authService, askService, offerService, messageService, notificationService
├─ mocks/              users, asks, offers, messages, notifications, categories
└─ utils/              validators.js, formatCurrency.js, formatDate.js
```

## Auth (mock, no backend)

`AuthContext` persists the logged-in user to `localStorage` (`uask.auth.user`) via `useLocalStorage`. `authService.login`/`.signup` simulate a network call (~400ms) and either match a seeded mock user by email or fabricate a minimal profile. `ProtectedRoute` redirects unauthenticated visits to `/app/*` → `/login` (remembering the original destination via router state so login returns you there); an authenticated visit to `/login` or `/signup` redirects to `/app/dashboard`.

## Progress

- [x] Phase 1 — Setup (Vite, tokens/reset/base/utilities, fonts)
- [x] Phase 2 — Routing + layouts (route tree, ProtectedRoute, placeholder pages)
- [x] Phase 3 — UI kit (13 components + `/styleguide`)
- [x] Phase 4 — Landing page (all sections, Navbar/Footer, scroll-reveal motion)
- [x] Phase 5 — Auth screens (Login/Signup forms, AuthContext, localStorage persistence)
- [x] Phase 6 — Mocks + services (6 mock files, 5 service files)
- [x] Phase 7 — core product loop. Build order (per blueprint §8):
  - [x] 7A. Discover ASKs (read-only list)
  - [x] 7B. ASK Details (read-only)
  - [x] 7C. Create ASK (first write)
  - [x] 7D. Respond to ASK (second write)
  - [x] 7E. Compare responses (depends on both writes)
  - [x] 7F. Dashboard (aggregates everything)
- [x] Phase 8 — Secondary screens (Messages, Notifications, Profile)
  - [x] 8A. Messages (thread list + conversation view)
  - [x] 8B. Notifications (grouped list, mark read/mark all read)
  - [x] 8C. Profile (own-profile edit, public read-only view)
- [x] Phase 9 — Frontend polish + QA (nav chrome, empty/error/loading states, a11y, spacing/breakpoint consistency, mobile pass at 375px, removed `/styleguide`)
- [ ] **Next: Phase 10 — API swap (`services/http.js`, real backend)**

## Workflow rules

- Work **one phase (or sub-phase) at a time** — don't jump ahead or bundle multiple phases into one change.
- **Run and test before continuing** (`npm run build`, then exercise the feature in a real browser — don't just eyeball the code).
- **Don't redo completed phases** unless explicitly asked to.
- **Stop after the requested phase/sub-phase** and report what changed — don't keep going into the next one unprompted.
- **Backend/API integration has not started.** The frontend is still 100% mock-driven — Phase 10 (`services/http.js`, real API) is next but not yet requested. Don't begin it unprompted.
- **Don't begin redesign work** on completed phases/screens, and don't modify app code, unless a specific task explicitly calls for it — preserve the current UASK brand system and existing functionality as-is.
