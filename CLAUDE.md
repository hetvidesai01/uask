# UASK — Frontend

Full spec lives in `UASK_FRONTEND_BLUEPRINT.md`. Read that first for anything not covered here — this file is the quick-context summary, that file is the source of truth for detailed specs (route map, component prop tables, exact token values, build order). **Note:** the blueprint's own §5 "Design system" section describes the *original light-mode* palette and button/badge treatments — that was superseded by the dark editorial redesign (see below). The token values, button variants, and badge colors documented in *this* file reflect the current, actual state; treat the blueprint as historical/structural reference only for anything visual.

## What UASK is

A **reverse marketplace**: users post what they need (an "ASK") and relevant providers respond with offers, instead of searching a catalog of listings.

**Core flow:** `ASK → MATCH → RESPOND → COMPARE → CONNECT`

## Scope

**Frontend only, for now.** No backend, no database, no real API. All data is mock (`src/mocks/`) served through a service layer (`src/services/`) with artificial delays, designed to be swapped for real HTTP calls later without touching any page code.

## Tech stack

- React + Vite
- React Router (client-side routing, `BrowserRouter`)
- Plain CSS with **CSS Modules** (`Component.module.css`)
- **Framer Motion** — added during the dark editorial redesign for the motion system (page/section reveals, staggered groups, the landing "signal rail," count-up stats). Wired globally via `<MotionConfig reducedMotion="user">` in `main.jsx`, so every `motion.*` component automatically respects `prefers-reduced-motion`.

**Explicitly not used** unless the user asks for it later: Tailwind, TypeScript, Redux, a backend, a database.

## Design system — source of truth

`src/styles/tokens.css` defines every brand color, font, spacing, radius, shadow, gradient, and glow as a CSS custom property. **Never hard-code a hex value or px number in a component — always reference a token.**

UASK is now a **dark editorial / cinematic** product (redesigned from the original light theme — see "Visual redesign" under Progress). Key facts about the current token set:

- **Brand hexes are unchanged from the original spec** — `--c-red: #D02727`, `--c-red-deep: #992E34`, `--c-red-dark: #6E1414`, `--c-pink: #F7B4B4`, `--c-pink-tagline: #F0B8B8`. The redesign never altered these five values, only how/where they're used.
- **Neutrals are now dark**: `--c-bg: #0B0A0A` (canvas), `--c-surface: #141212`, `--c-surface-2: #1C1919`, `--c-surface-3: #262121`, `--c-text: #F5EFEC`, `--c-text-mute: #A99C99`, `--c-text-faint: #6E6260` (decorative/non-essential metadata only — below body-text AA), `--c-border: #2E2828`, `--c-border-hover: #4A3E3E`.
- **Brand-derived accents (new)**: `--c-red-accent: #E6514D` (the *only* red allowed as small foreground text or a focus ring on a dark surface — verified ≥4.5:1), `--c-red-wash: rgba(208,39,39,.16)` (soft interactive tint), `--grad-signal` (the signature red gradient), `--glow-red-sm` / `--glow-red-md` (restrained glow shadows).
- **Contrast rule, documented as comments in `tokens.css` itself**: `--c-red-deep` / `--c-red-dark` = fills/backgrounds/gradient stops *only*, never foreground text or borders on a dark neutral (both measure well under 3:1 there). `--c-red` = borders/icons/decorative accents (clears 3:1). `--c-red-accent` = small foreground text and focus rings (clears 4.5:1). This rule was the source of several real contrast bugs found and fixed during the redesign — respect it in any new component.
- **Status colors were brightened** for dark-surface legibility (`--c-success`, `--c-warning`, `--c-info`); `--c-danger` now aliases `--c-red-accent` (was `--c-red-dark`).
- **Shadows are black-based** (`--sh-sm/md/lg` use `rgba(0,0,0,…)`), not the light-tuned rgba values from the original spec. Elevation is primarily **surface lightness + border**, shadows are a secondary depth cue — heavy box-shadow stacking is avoided by convention.
- Typography rules (`--font-display` reserved for landing H1/section H2s/hero-style titles; everything else `--font-body`) are unchanged. No monospace font was added — considered during the redesign and explicitly deferred.
- Breakpoints unchanged: mobile-first, `min-width` only — `640px`, `900px`, `1200px`.

Global utility classes (`src/styles/utilities.css`): `.container`, `.stack`, `.row`, `.section`, `.reveal`/`.isVisible`, `.sr-only` — unchanged.

**Motion system**: `src/utils/motion.js` exports reusable Framer Motion variants (`staggerContainer`, `staggerItem`, `lineReveal`, `cardEntrance`, `hoverLift`). `src/hooks/useReducedMotion.js` re-exports Framer Motion's hook for the rare case a component needs to branch logic explicitly (e.g. `useCountUp`, since Framer's imperative `animate()` API doesn't read the `MotionConfig` context automatically). Rule established during the redesign: **motion communicates state/hierarchy, it doesn't decorate** — no infinite/looping animation anywhere, no scroll-linked parallax, no 3D tilt.

**Graphics primitives**: `components/ui/GrainOverlay` (a static, low-opacity film-grain texture mounted once globally in `App.jsx`) and `components/ui/GradientMesh` (a reusable low-opacity red/pink radial glow, used on the landing hero and final CTA band — not mounted globally).

**Mobile-first, accessible by default:** unchanged — every input has a real `<label>`, every icon-only control has an `aria-label`, visible `:focus-visible` ring everywhere (now `--c-red`, not `--c-red-deep` — that was one of the contrast fixes), touch targets sized comfortably, Modal has a real focus trap + focus restore, Tabs support arrow-key navigation.

## Architecture rules

- **Pages/components never import from `mocks/`.** Only files in `src/services/` may import from `src/mocks/`. Pages call `services/*Service.js` functions, which internally read/filter the mock arrays (and later, will call a real API) with the same function signature either way. This was upheld throughout the redesign and the product-structure changes — the new `contractService.js` follows the identical pattern.
- **Components don't import from `pages/`.** Data flows one direction: `pages/` → `services/` → `mocks/` (mock era) or `services/` → `http.js` → API (post-Phase-9).
- Reusable UI atoms live in `components/ui/` — the original 13 (Button, Input, Textarea, Select, Card, Badge, Avatar, Spinner, EmptyState, Modal, Tabs, Tag, StatCard), plus `GrainOverlay` and `GradientMesh` added during the redesign.
- Public-site chrome lives in `components/layout/` (Navbar, Footer) — Navbar is now scroll-aware (transparent-over-hero on the landing route only, solid elsewhere).
- App-shell chrome (`layouts/AppLayout.jsx`) now includes a genuine **desktop top bar** (search input, read-only role indicator, notification bell with combined unread badge, account dropdown menu) in addition to the sidebar — this is a change from the original Phase-9 build, where desktop had sidebar-only navigation and "top bar" was mobile-only. A standalone `PageHeader` component is still the one piece of the original blueprint shell not built.
- Domain components live in `components/ask/`, `components/offer/`, `components/messages/`, `components/notifications/`, `components/contract/` (currently just `ContractStatusBadge`, added for the Contract + Milestone flow), and `components/premium/` (`UpgradeTeaser`, `PremiumModal` — added for the Premium/Upgrade flow).
- The Premium/Upgrade flow is a **modal, not a route** (`AppLayout` owns the `subscription`/`premiumOpen` state and renders `PremiumModal` once, globally, rather than adding an `/app/premium` page) — chosen because it integrates with the shell without touching `App.jsx`'s route tree or any individual page. `subscriptionService.js` follows the same mock-service pattern as the rest of `services/` (delay + localStorage-backed persistence, same call signature a real API would use later).
- `components/onboarding/` (currently just `ProductTour`) holds the guided-onboarding modal, added for the Help Center + Onboarding phase. `ProductTour` is mounted once in `AppLayout` (like `PremiumModal`) and auto-opens for a logged-in user until they Skip/Finish it; completion is tracked per-user in localStorage via `src/utils/onboarding.js`'s `onboardingStorageKey(userId)`, which both `ProductTour` (read/write via `useLocalStorage`) and the Help page's "Restart Product Tour" control (`resetOnboarding(userId)`, then navigates to `/app/dashboard`) agree on.
- `/help` is a **public route** (rendered inside `PublicLayout`, reachable logged-out or logged-in — same pattern the existing `/` route already follows). Since the app shell (`AppLayout`) has no nav item pointing at it, a small "❓ Help" icon-link was added to both the mobile and desktop top bars (next to the notification bell) purely so a logged-in user has a way to reach it and the "Restart Product Tour" control — this is the one shell change in that phase, everything else about `AppLayout` is unchanged.
- Page folder convention: `PageName/index.jsx` + `PageName.module.css`, plus any page-local sub-components in the same folder — e.g. `Landing/` (multi-section), `Dashboard/` (shell + `DashboardOverview` + `DashboardPayments` + `ActivityFeed` + `useCountUp`), `Inbox/` (shell + `Thread` + `NotificationsPanel`), `Contract/` (shell + `MilestoneTimeline` + `RatingForm`), `AskDetails/` (+ `StatusRail`).

## Folder structure (current)

```
src/
├─ main.jsx (wraps app in <MotionConfig reducedMotion="user">), App.jsx (route tree), index.css
├─ styles/            tokens.css (dark editorial), reset.css, base.css, utilities.css
├─ layouts/           PublicLayout, AppLayout (sidebar + desktop top bar + mobile shell), ProtectedRoute
├─ pages/             one folder per route (see App.jsx for the route map)
│  ├─ Landing/         Hero + HeroSignal, FlowSection ("signal rail"), ValueProps, SampleAsks, Categories, Cta
│  ├─ Dashboard/        shell (nav switch) + DashboardOverview + DashboardPayments + ActivityFeed + useCountUp
│  ├─ AskDetails/       + StatusRail (compact ASK→MATCH→RESPOND→COMPARE→CONNECT progress rail)
│  ├─ Contract/         Contract summary/payment/milestones/rating screen + MilestoneTimeline + RatingForm
│  ├─ Inbox/            merged Messages + Notifications (tabs) + Thread + NotificationsPanel
│  ├─ Help/             HowItWorksSection (signal rail), GuideSection (shared, used for both guides), FaqSection (accordion), ProductTourCallout
│  ├─ DesignPreview/    temporary, dev-only — inspects the dark token system; not linked from nav
│  └─ (Login, Signup, CreateAsk, DiscoverAsks, RespondToAsk, CompareResponses, Profile, NotFound — unchanged)
├─ components/
│  ├─ ui/              generic, reusable, no business logic (13 original + GrainOverlay + GradientMesh)
│  ├─ layout/          Navbar (scroll-aware), Footer
│  ├─ ask/              AskCard, AskFilters, AskFormStep1-4, AskMetaGrid, AskStatusBadge, UserMiniCard
│  ├─ offer/            OfferCard, OfferFormStep1-3, OfferList, OfferStatusBadge
│  ├─ messages/         ThreadList, ThreadListItem, MessageBubble, MessageComposer
│  ├─ notifications/    NotificationItem
│  ├─ contract/         ContractStatusBadge
│  ├─ premium/          UpgradeTeaser (right-side app-shell teaser), PremiumModal (Basic/Premium compare + mock upgrade)
│  └─ onboarding/       ProductTour (guided-onboarding modal, mounted in AppLayout)
├─ context/            AuthContext.jsx, ToastContext.jsx
├─ hooks/               useAuth, useToast, useLocalStorage, useInView, useReducedMotion
├─ utils/               motion.js (Framer Motion variants), formatDate.js, formatCurrency.js, validators.js, onboarding.js (localStorage key + reset helper)
├─ services/            authService, askService, offerService, messageService, notificationService, contractService, subscriptionService
└─ mocks/               users, asks, offers, messages, notifications, categories, contracts, subscriptions
```

## Route map (current)

```
/                              Landing
/help                          Help center — How UASK Works, guides, FAQs, Restart Product Tour (Product Change Phase 6)
/login, /signup
/design-preview                temporary, dev-only

/app                           → redirect to /app/dashboard
/app/dashboard                 Dashboard overview (My ASKs / My Offers / Activity)
/app/dashboard/payments        Payments & Milestones (Revenue, Average Rating, Milestones + Profile Booster)
/app/asks/new                  Create ASK
/app/discover                  Discover ASKs
/app/asks/:askId               ASK details (shows "View Contract" once an offer is accepted)
/app/asks/:askId/respond       Respond to ASK
/app/asks/:askId/compare       Compare responses
/app/asks/:askId/contract      Contract + milestones + rating (new — Product Change Phase 3)
/app/inbox                     Inbox — Messages tab (default)
/app/inbox/messages/:threadId  Inbox — Messages tab, thread open
/app/inbox?tab=notifications   Inbox — Notifications tab
/app/profile, /app/profile/:userId

/app/messages, /app/messages/:threadId, /app/notifications   → redirect to the /app/inbox equivalents (back-compat only)
```

## Auth (mock, no backend)

`AuthContext` persists the logged-in user to `localStorage` (`uask.auth.user`) via `useLocalStorage`. `authService.login`/`.signup` simulate a network call (~400ms) and either match a seeded mock user by email or fabricate a minimal profile. `ProtectedRoute` redirects unauthenticated visits to `/app/*` → `/login` (remembering the original destination via router state so login returns you there); an authenticated visit to `/login` or `/signup` redirects to `/app/dashboard`.

## Progress

### Original build (Phases 1–9)
- [x] Phase 1 — Setup
- [x] Phase 2 — Routing + layouts
- [x] Phase 3 — UI kit (13 components + `/styleguide`, later removed)
- [x] Phase 4 — Landing page (original light-mode version — since redesigned)
- [x] Phase 5 — Auth screens
- [x] Phase 6 — Mocks + services
- [x] Phase 7 — Core product loop (Discover, ASK Details, Create ASK, Respond, Compare, Dashboard)
- [x] Phase 8 — Secondary screens (Messages, Notifications, Profile — Messages/Notifications later merged into Inbox)
- [x] Phase 9 — Frontend polish + QA
- [ ] **Phase 10 — API swap** (`services/http.js`, real backend) — not started. All services are still 100% mock.

### Visual redesign — dark editorial / cinematic system (done, all phases)
- [x] Design foundation — dark token system, motion utilities, `GrainOverlay`/`GradientMesh`, `/design-preview`
- [x] Landing page redesign — scroll-aware Navbar, cinematic hero + `HeroSignal` graphic, flow section rebuilt as a "signal rail," editorial value props, premium sample-ASK cards, index-style categories, gradient-mesh CTA, restyled Footer
- [x] App shell redesign — dark sidebar with rail-indicator active state, new desktop top bar (search/role indicator/notifications/account menu), restyled mobile nav + FAB
- [x] Core loop screens redesign — Dashboard, Discover, ASK Details (+ compact status rail), Compare Responses restyled to the dark system with restrained motion

### Product structure changes (see conversation history for the full 8-item plan; status below)
- [x] Unified Inbox — merged Messages + Notifications into `/app/inbox` (tabs), combined unread badge, old routes redirect
- [x] Dashboard restructuring — split into ASKs & Offers (`/app/dashboard`) and Payments & Milestones (`/app/dashboard/payments`) sub-routes with a real internal nav switch
- [x] Contract + Payment/Milestone flow — "View Contract" entry point from ASK Details once an offer is accepted, full Contract screen (summary/deliverables/payment summary/milestone timeline with role-based mock actions/completion/rating), feeds Dashboard's Revenue/Average Rating/Milestones metrics
- [ ] AI Ask Assistant (inside Create ASK) — not started
- [x] Premium/Upgrade screen — right-side `UpgradeTeaser` on all `/app/*` screens (collapsible, dismissible, fixed on desktop ≥1200px / inline banner below that) + `PremiumModal` (Basic vs Premium comparison, ₹149/mo or ₹999/yr, mock "Upgrade to Premium" flow via `subscriptionService`, no real billing)
- [x] Help section (replacing "How it works" in public nav; FAQs/guides) — `/help` (public route): How UASK Works (signal rail), Guide for ASK creators, Guide for providers, accordion FAQs, plus a "Restart Product Tour" control. Guided onboarding: `ProductTour` (5 steps — Discover/Create ASK/Inbox/Dashboard/Profile — Next/Back/Skip/Finish), auto-opens once per user in `AppLayout`, completion tracked in localStorage
- [ ] Profile rating display tweak ("4.8 / 5" format) — not started
- [x] "Browse" → "Discover" wording pass (Navbar, Discover subtitle, Dashboard empty state, Landing categories heading)

## Workflow rules

- Work **one phase (or sub-phase) at a time** — don't jump ahead or bundle multiple phases into one change.
- **Run and test before continuing** (`npm run build`, then exercise the feature in a real browser — don't just eyeball the code).
- **Don't redo completed phases** unless explicitly asked to.
- **Stop after the requested phase/sub-phase** and report what changed — don't keep going into the next one unprompted.
- **Backend/API integration has not started.** The frontend is still 100% mock-driven — Phase 10 (`services/http.js`, real API) is next but not yet requested. Don't begin it unprompted.
- **Don't begin redesign work** on completed phases/screens, and don't modify app code, unless a specific task explicitly calls for it — preserve the current UASK brand system and existing functionality as-is.
