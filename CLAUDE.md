# UASK — Frontend

Full spec lives in `UASK_FRONTEND_BLUEPRINT.md`. Read that first for anything not covered here — this file is the quick-context summary, that file is the source of truth for detailed *structural* specs (route map shape, component prop tables, build order). **Note:** the blueprint's own §5 "Design system" section describes the *original light-mode* palette from the very first build — that was superseded by a dark editorial/cinematic redesign, which has since itself been superseded by the current **"Open Call"** light system (see "Design system — source of truth" below, which reflects the actual current code). Treat the blueprint as historical/structural reference only for anything visual.

## What UASK is

A **reverse marketplace**: users post what they need (an "ASK") and relevant providers respond with offers, instead of searching a catalog of listings.

**Core flow:** `ASK → MATCH → RESPOND → COMPARE → CONNECT`

**Marketplace positioning:** UASK is a **professional / project-based** reverse marketplace — Design, Development,
Photography/Videography, Writing, Marketing, Branding, Content Creation, Business/Strategy, Data/Analytics,
Technology, and similar professional/creative categories. It does **not** position itself around home services,
household errands, cleaners, plumbers, electricians, movers, or delivery-style local chores — those category
examples were deliberately removed from the mock category taxonomy and sample content (see "Progress" below);
don't reintroduce them in new copy, categories, or seed data.

## Current product state

A fully functional frontend is built — React + Vite, React Router, plain CSS / CSS Modules, Framer Motion, a
mock-first service architecture (`services/` is the only layer allowed to import `mocks/`) — with **no real
backend/API integration yet**.

### Completed product features
- [x] Authentication (mock, localStorage-persisted)
- [x] Landing page
- [x] Discover ASKs
- [x] ASK Details
- [x] Create ASK
- [x] Respond to ASK
- [x] Compare Responses
- [x] Dashboard
- [x] Unified Inbox — Messages + Notifications tabs
- [x] Payments & Milestones dashboard
- [x] Contract + milestone workflow, mock payment states, contract-completion rating/review
- [x] Profile Booster concept (frontend/mock reputation signal — not a real ranking algorithm)
- [x] Premium/Upgrade experience — Basic vs Premium comparison, right-edge Premium teaser that opens a right-side
  slide-over `PremiumDrawer`
- [x] Help Center + guided onboarding
- [x] Profile & reputation upgrade — ratings out of 5, reviews, completed contract history, portfolio mock section
- [ ] **AI Ask Assistant** — mentioned in Help's guide copy and the onboarding tour as a planned capability, but
  **still not implemented** in Create ASK (re-verified against the code — nothing AI-related exists under
  `pages/CreateAsk/`). This is explicitly in scope for **Light Redesign Phase 4** below — don't assume it exists
  before then, and don't build it ahead of that phase being requested.

### Important terminology
Use these terms consistently everywhere:
- **Discover ASKs** — never "Browse ASKs"
- **Create ASK** — the sidebar button, mobile FAB, and the `/app/asks/new` page heading all say exactly this
- **Inbox** — not separate "Messages" / "Notifications" nav items (those are tabs *inside* Inbox, which is correct)
- **Basic** / **Premium** — the two plan names
- **Payments & Milestones** — the Dashboard sub-route and its heading
- **Profile Booster** — the reputation-signal concept; don't rename it "reputation score" or similar

### Payments & Milestones metrics
Top metrics on `/app/dashboard/payments` (and mirrored, scoped to a provider's own contracts, in `Profile`'s
Reputation section):
- **Revenue** — sum of paid milestone amounts across the provider's active + completed contracts
- **Average Rating** — mean of `rating` across the provider's completed + rated contracts, formatted `"X.X / 5"`
- **Milestones** — completed/total count, a progress bar, and the **Profile Booster** impact
  (`round(completedMilestones / totalMilestones × 20)` — the same simple formula, computed independently but
  identically, in `DashboardPayments`, `Contract`, and `Profile`'s `getProviderReputation`)

### Premium
- Pricing: **₹149/month** or **₹999/year**
- Comparison includes: unlimited AI ASK Assistant, AI Proposal Assistant, AI Matching, Auto Contracts, Profile
  Boosts, advanced analytics, smart alerts (full Basic-vs-Premium table lives in `components/premium/PremiumDrawer`)
- Entry point is a small always-visible teaser (`components/premium/UpgradeTeaser`) that rests mostly off the right
  edge of the viewport and slides into view on hover/focus — not a persistent card, and no dismiss/collapse state.
  Clicking it opens `PremiumDrawer`, a right-side slide-over (built on the generic `components/ui/Drawer` atom —
  see "Design system" below) with the same comparison table, pricing, and mock upgrade flow the old centered
  `PremiumModal` had before it was replaced.
- **No real billing/payment integration exists** — `subscriptionService.js` is a mock, localStorage-backed
  service; "Upgrade to Premium" is a simulated flow only

### Current visual direction — IMPORTANT
The product is mid-way through the **"Open Call"** light redesign (approved conceptually as a full strategy —
creative concept, color/typography/motion systems, screen-by-screen treatment — captured in a Claude Artifact from
the planning session; summarized here). It replaced an earlier dark editorial/cinematic redesign, which itself
replaced the original light-mode build from the blueprint. Characteristics: light, editorial, kinetic, youthful
creative-tech; warm off-white canvas; strong red/burgundy brand accents; more purposeful animation and motion.
Keeps all five original brand hexes (`#D02727`, `#992E34`, `#F7B4B4`, `#6E1414`, `#F0B8B8`) and uses a warm light
neutral system (canvas ≈ `#FBF3EF`, surface ≈ `#FFFDFB`, blush ≈ `#F9DAD5`, ink ≈ `#241512`). Typography:
**Instrument Serif** + **Instrument Sans** as the display/UI pair, **EB Garamond** kept selectively, **JetBrains
Mono** used selectively for data/numerals. Motion direction: staggered reveals, spring interactions, cursor-reactive
cards, animated counters, shared layout transitions, spring progress animations, subtle page transitions — all
respecting `prefers-reduced-motion`. (A true cursor-following "magnetic" CTA was considered for Phase 2/3 CTAs but
deliberately not built — the design foundation doesn't have a magnetic primitive, so those buttons use spring
hover/press motion instead; build a magnetic primitive first if that's explicitly wanted later.)

**Phases 1–3 are done. Phase 4 has not been started — wait for explicit instruction before beginning it.**
1. ~~Light design foundation~~ — done
2. ~~Landing page~~ — done
3. ~~App shell~~ — done
4. Core product loop (Discover ASKs, ASK Details, Create ASK + AI Assistant, Respond to ASK) — **next, not started**
5. Dashboard + Payments & Milestones
6. Contract + Inbox
7. Profile + Premium + Help
8. Motion polish + full QA

**Do not assume any page beyond Landing and the app shell chrome (Navbar/Footer/AppLayout) has been visually
redesigned.** Dashboard, Discover, ASK Details, Create ASK, Respond to ASK, Compare Responses, Contract, Inbox,
Profile, Help, and the Premium comparison content all still use dark-editorial-era layout/motion — they only look
different from before because the global tokens are 100% inherited from Phase 1's light palette, not because their
layout, spacing, motion, or copy has been touched.

## Scope

**Frontend only, for now.** No backend, no database, no real API. All data is mock (`src/mocks/`) served through a service layer (`src/services/`) with artificial delays, designed to be swapped for real HTTP calls later without touching any page code.

## Tech stack

- React + Vite
- React Router (client-side routing, `BrowserRouter`)
- Plain CSS with **CSS Modules** (`Component.module.css`)
- **Framer Motion** — the app's motion system (page/section reveals, staggered groups, spring interactions, count-up stats, the product-story sequence on Landing). Wired globally via `<MotionConfig reducedMotion="user">` in `main.jsx`, so every `motion.*` component automatically respects `prefers-reduced-motion`.

**Explicitly not used** unless the user asks for it later: Tailwind, TypeScript, Redux, a backend, a database.

## Design system — source of truth

`src/styles/tokens.css` defines every brand color, font, spacing, radius, shadow, and gradient as a CSS custom
property. **Never hard-code a hex value or px number in a component — always reference a token.**

UASK is currently the light editorial **"Open Call"** system (Light Redesign Phases 1–3):

- **Brand hexes unchanged from the original spec** — `--red: #D02727`, `--red-deep: #992E34`, `--burgundy: #6E1414`,
  `--pink: #F7B4B4`, `--pink-tagline: #F0B8B8`. Every earlier `--c-red`/`--c-red-deep`/`--c-red-dark`/`--c-pink`/
  `--c-pink-tagline` name still works — aliased to these bare tokens for backward compatibility with the ~50
  existing consumers that predate Phase 1.
- **Neutrals are warm and light**: `--canvas: #FBF3EF` (page background, aliased as `--c-bg`), `--surface:
  #FFFDFB` (raised card background, aliased as `--c-surface`), `--blush: #F9DAD5` and `--blush-deep: #F3BFB8`
  (soft accent surfaces — active nav pills, decorative bands), `--ink: #241512` / `--ink-mute: #6B5750` /
  `--ink-faint: #A89189` (aliased as `--c-text` / `--c-text-mute` / `--c-text-faint`), `--border: #EAD6CF` /
  `--border-strong: #DFB9B0` (aliased as `--c-border` / `--c-border-hover`).
- **Contrast rule** (inverted from the old dark-theme rule): `--red` clears ~4.8:1 directly on the light neutrals
  above, so unlike the dark system it's safe as small foreground text, icons, borders, and focus rings on its own
  — `--c-red-accent` simply aliases `--red`. `--red-deep` / `--burgundy` are for richer fills, hover states, and
  text that wants more weight (e.g. on a pale `--c-red-wash` band). `--pink` / `--pink-tagline` are decoration/fill
  only, or foreground text on a *dark* band — never foreground text directly on the light canvas/surface (this was
  the source of several real contrast bugs found and fixed during the Phase 1 palette flip — Badge, AppLayout,
  PremiumDrawer's plan cards, Landing's hero kicker).
- **Status colors** tuned for light-surface legibility (`--c-success: #2E7D57`, `--c-warning: #B8860B`,
  `--c-info: #2B6CB0`); `--c-danger` aliases `--red`.
- **Elevation**: `--shadow-card` / `--shadow-lift` are warm, directional, burgundy-tinted shadows (not black-based)
  — aliased as `--sh-sm`/`--sh-md`/`--sh-lg` for older consumers. Elevation is primarily surface lightness + a
  hairline border; shadows are a secondary, restrained depth cue.
- **Typography**: `--font-display` → Instrument Serif (major editorial headings — landing H1, section H2s,
  hero-style titles), `--font-body` → Instrument Sans (everything else), `--font-heritage` → EB Garamond
  (occasional expressive moments, used selectively), `--font-mono` → JetBrains Mono (prices, stats, timestamps,
  small data labels — used selectively, e.g. `StatCard`'s value, `AnimatedCounter`).
- **Radius**: `--r-sm: 8px`, `--r-md: 14px`, `--r-lg: 20px`, `--r-full: 999px` — rounder than the old dark system.
- Breakpoints unchanged: mobile-first, `min-width` only — `640px`, `900px`, `1200px`.
- `html { color-scheme: light; }` (was `dark` before Phase 1 — affects native form-control/scrollbar theming).

Global utility classes (`src/styles/utilities.css`): `.container`, `.stack`, `.row`, `.section`,
`.reveal`/`.isVisible`, `.sr-only`, plus typography helpers `.text-display` / `.text-heritage` / `.text-mono`.

**Motion system**: `src/utils/motion.js` exports reusable Framer Motion variants — `staggerContainer`,
`staggerItem`, `fadeRise`, `springScale`, `pageEntrance`, `lineReveal`, `cardEntrance`, `hoverLift`.
`src/hooks/useReducedMotion.js` re-exports Framer Motion's hook for the cases where a component needs to branch
logic explicitly rather than rely on `MotionConfig` — anywhere using Framer's *imperative* APIs (`animate()`,
`useMotionValue`/`useSpring`/`useTransform`) rather than the declarative `motion.*` props, e.g. `useCountUp`,
`AnimatedCounter`, and Landing's cursor-tilt `TiltCard`. Rule established during the redesign and still in force:
**motion communicates state/hierarchy, it doesn't decorate** — no infinite/looping animation anywhere (the one
sanctioned exception is `Spinner`'s loading rotation), no scroll-linked parallax, no constant/idle-nudge
animations (considered for the Premium teaser, deliberately left out for this reason).

**Reusable atoms added during the light redesign** (`components/ui/`): `SignalMark` (broadcast-mark primitive —
central dot + optional radiating rings, static or one-shot-animated, used in Landing's hero/product-story/CTA),
`FloatingCard`, `StaggerReveal`, `AnimatedCounter`, `HandUnderline`, `Drawer` (generic right-side slide-over —
focus trap, Escape-to-close, overlay-click-to-close, focus restore, body-scroll lock, spring slide animation; this
is the `Drawer` atom the original blueprint planned but never built — `PremiumDrawer` is its first consumer, it's
available for other uses like a future mobile filter drawer).

**Graphics primitives**: `components/ui/GrainOverlay` (a static, low-opacity film-grain texture mounted once
globally in `App.jsx`) and `components/ui/GradientMesh` (a reusable low-opacity red/pink radial glow, used on the
Landing hero — not mounted globally).

**Mobile-first, accessible by default:** every input has a real `<label>`, every icon-only control has an
`aria-label`, visible `:focus-visible` ring everywhere (`--red`), touch targets sized comfortably, `Modal` and
`Drawer` both have a real focus trap + focus restore, `Tabs` supports arrow-key navigation.

## Brand assets

**Official logo:** `src/assets/brand/uask.logo.png` — a transparent-background PNG lockup ("Uask" wordmark + the
signal-dot motif already built into the "U," plus a baked-in tagline). This is the one official logo file; do not
redraw, re-export, crop, or otherwise modify it — resize only via CSS (`height` + `width: auto`, plus
`object-fit: contain` as a backstop) to preserve its aspect ratio. **Watch for flex containers with no explicit
`align-items`** — a column flex parent's default `stretch` distorted the Footer logo once already (fixed with
`align-self: flex-start`); check any new placement the same way.

Rendered in place of a text "UASK" wordmark at every major brand position: the public `Navbar` (also covers the
Login/Signup auth screens, which have no logo of their own and rely on `Navbar` via `PublicLayout`), `Footer`,
`AppLayout`'s sidebar + mobile top bar (both instances), and Landing's `CtaSection`. Each usage is
`<img src={uaskLogo} alt="UASK" ... />` — always keep the `alt="UASK"` text exactly as-is. Textual mentions of
"UASK" elsewhere (page copy, titles like "UASK Premium," the footer copyright line, document `<title>`) stay as
plain text — only standalone brand-mark lockups get the image.

## Architecture rules

- **Pages/components never import from `mocks/`.** Only files in `src/services/` may import from `src/mocks/`. Pages call `services/*Service.js` functions, which internally read/filter the mock arrays (and later, will call a real API) with the same function signature either way.
- **Components don't import from `pages/`.** Data flows one direction: `pages/` → `services/` → `mocks/` (mock era) or `services/` → `http.js` → API (post-Phase-10).
- Reusable UI atoms live in `components/ui/` — the original 13 (Button, Input, Textarea, Select, Card, Badge, Avatar, Spinner, EmptyState, Modal, Tabs, Tag, StatCard) plus the light-redesign additions listed under "Design system" above.
- Public-site chrome lives in `components/layout/` (Navbar, Footer) — Navbar is scroll-aware (transparent-over-hero on the landing route only, solid elsewhere) and renders the logo image; Footer renders the logo image too.
- App-shell chrome (`layouts/AppLayout.jsx`): a floating light sidebar panel (desktop, inset with rounded corners + soft shadow, not a full-bleed rail), a sticky desktop top bar (search, read-only role indicator, notification bell with combined unread badge, account dropdown menu), and a separate mobile shell (top bar + bottom tab bar + FAB). A standalone `PageHeader` component is still the one piece of the original blueprint shell not built.
- Domain components live in `components/ask/`, `components/offer/`, `components/messages/`, `components/notifications/`, `components/contract/` (currently just `ContractStatusBadge`), and `components/premium/` (`UpgradeTeaser` — the edge-peek teaser, `PremiumDrawer` — the slide-over comparison, built on `components/ui/Drawer`).
- The Premium/Upgrade flow is a **drawer, not a route** (`AppLayout` owns the `subscription`/`premiumOpen` state and renders `PremiumDrawer` once, globally) — same reasoning as before: integrates with the shell without touching `App.jsx`'s route tree or any individual page. `subscriptionService.js` follows the same mock-service pattern as the rest of `services/` (delay + localStorage-backed persistence, same call signature a real API would use later).
- `components/onboarding/` (currently just `ProductTour`) holds the guided-onboarding modal, mounted once in `AppLayout` (like `PremiumDrawer`) and auto-opens for a logged-in user until they Skip/Finish it; completion is tracked per-user in localStorage via `src/utils/onboarding.js`'s `onboardingStorageKey(userId)`.
- `/help` is a **public route** (rendered inside `PublicLayout`, reachable logged-out or logged-in). A small "❓ Help" icon-link sits in both the mobile and desktop app-shell top bars.
- Profile & Reputation: the reputation math (`getProviderReputation`, `getCompletedContractsForProvider`) lives in `contractService.js` — the same milestone-based Profile Booster formula used on the Payments dashboard and the Contract page. `Profile/index.jsx` only renders the reputation/reviews/completed-work/portfolio sections for the `provider` role, and falls back to the profile's seeded `rating`/`reviewCount` whenever there's no rated completed contract yet.
- **Mock user persistence**: `authService.js`'s `users` array is localStorage-persisted (key `uask.mock.users`), not just re-imported fresh from `mocks/users.js` on every load. This matters because `login()`/`signup()` push newly-created users into that array at runtime — without persisting it, a reload would reset `users` to just the 3 seeded accounts, and `getUserById(currentUser.id)` would return `null` for anyone else, even though `AuthContext`'s own separate localStorage key still remembered them as logged in (this was a real bug — "Profile not found" on your own `/app/profile` after a refresh — fixed by persisting the array; see "Progress" below). `updateUser()` also persists, so profile edits now survive a reload too.
- Page folder convention: `PageName/index.jsx` + `PageName.module.css`, plus any page-local sub-components in the same folder — e.g. `Landing/` (multi-section), `Dashboard/` (shell + `DashboardOverview` + `DashboardPayments` + `ActivityFeed` + `useCountUp`), `Inbox/` (shell + `Thread` + `NotificationsPanel`), `Contract/` (shell + `MilestoneTimeline` + `RatingForm`), `AskDetails/` (+ `StatusRail`).

## Folder structure (current)

```
src/
├─ main.jsx (wraps app in <MotionConfig reducedMotion="user">), App.jsx (route tree), index.css
├─ assets/            brand/uask.logo.png — official logo asset (see "Brand assets" above)
├─ styles/            tokens.css (light "Open Call" system), reset.css, base.css, utilities.css
├─ layouts/           PublicLayout, AppLayout (floating sidebar + desktop top bar + mobile shell), ProtectedRoute
├─ pages/             one folder per route (see App.jsx for the route map)
│  ├─ Landing/         Hero + HeroSignal (light, asymmetric), FlowSection (animated ASK→MATCH→RESPOND→COMPARE→
│  │                   CONNECT product-story sequence, SignalMark-based — no longer the SignalRail atom),
│  │                   ReverseMarketplaceSection, ValueProps, SampleAsks (real data via askService/authService,
│  │                   cursor-tilt cards), Categories (spring/stagger chip cluster), Cta (blush surface + logo)
│  ├─ Dashboard/        shell (nav switch) + DashboardOverview + DashboardPayments + ActivityFeed + useCountUp
│  ├─ AskDetails/       + StatusRail (compact ASK→MATCH→RESPOND→COMPARE→CONNECT progress rail)
│  ├─ Contract/         Contract summary/payment/milestones/rating screen + MilestoneTimeline + RatingForm
│  ├─ Inbox/            merged Messages + Notifications (tabs) + Thread + NotificationsPanel
│  ├─ Help/             HowItWorksSection (signal rail — the shared SignalRail atom's only remaining consumer),
│  │                   GuideSection (shared, used for both guides), FaqSection (accordion), ProductTourCallout
│  ├─ Profile/          + ReputationMetrics, ReviewsSection, CompletedWorkSection, PortfolioSection (provider-only)
│  ├─ DesignPreview/    temporary, dev-only — inspects the light token system; not linked from nav
│  └─ (Login, Signup, CreateAsk, DiscoverAsks, RespondToAsk, CompareResponses, NotFound — not yet visually
│      redesigned; still dark-editorial-era layout with the light tokens inherited underneath)
├─ components/
│  ├─ ui/              generic, reusable, no business logic — the original 13 (Button, Input, Textarea, Select,
│  │                   Card, Badge, Avatar, Spinner, EmptyState, Modal, Tabs, Tag, StatCard) plus GrainOverlay,
│  │                   GradientMesh, SignalMark, SignalRail, FloatingCard, StaggerReveal, AnimatedCounter,
│  │                   HandUnderline, Drawer
│  ├─ layout/          Navbar (scroll-aware, renders the logo image), Footer (renders the logo image)
│  ├─ ask/              AskCard, AskFilters, AskFormStep1-4, AskMetaGrid, AskStatusBadge, UserMiniCard
│  ├─ offer/            OfferCard, OfferFormStep1-3, OfferList, OfferStatusBadge
│  ├─ messages/         ThreadList, ThreadListItem, MessageBubble, MessageComposer
│  ├─ notifications/    NotificationItem
│  ├─ contract/         ContractStatusBadge
│  ├─ premium/          UpgradeTeaser (right-edge peek tab), PremiumDrawer (Basic/Premium compare + mock upgrade,
│  │                   built on components/ui/Drawer)
│  └─ onboarding/       ProductTour (guided-onboarding modal, mounted in AppLayout)
├─ context/            AuthContext.jsx, ToastContext.jsx
├─ hooks/               useAuth, useToast, useLocalStorage, useInView, useReducedMotion
├─ utils/               motion.js (Framer Motion variants), formatDate.js, formatCurrency.js, validators.js, onboarding.js (localStorage key + reset helper)
├─ services/            authService (persists its mock `users` array to localStorage — see "Architecture rules"),
│                       askService, offerService, messageService, notificationService, contractService,
│                       subscriptionService, profileService
└─ mocks/               users, asks, offers, messages, notifications, categories, contracts, subscriptions,
                        portfolio — categories/asks no longer include "Home services"/"Errands" (see "Progress")
```

## Route map (current)

```
/                              Landing
/help                          Help center — How UASK Works, guides, FAQs, Restart Product Tour
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
/app/asks/:askId/contract      Contract + milestones + rating
/app/inbox                     Inbox — Messages tab (default)
/app/inbox/messages/:threadId  Inbox — Messages tab, thread open
/app/inbox?tab=notifications   Inbox — Notifications tab
/app/profile                   Own profile — resolves via the authenticated user's id (see "Auth" below)
/app/profile/:userId           Another user's profile

/app/messages, /app/messages/:threadId, /app/notifications   → redirect to the /app/inbox equivalents (back-compat only)
```

## Auth (mock, no backend)

`AuthContext` persists the logged-in user to `localStorage` (`uask.auth.user`) via `useLocalStorage`.
`authService.login`/`.signup` simulate a network call (~400ms) and either match a seeded mock user by email or
fabricate a minimal profile. `authService.js`'s underlying `users` array is *also* localStorage-persisted (key
`uask.mock.users` — see "Architecture rules" above) so a fabricated/signed-up user's own profile still resolves
after a reload, not just their login session. `ProtectedRoute` redirects unauthenticated visits to `/app/*` →
`/login` (remembering the original destination via router state so login returns you there); an authenticated
visit to `/login` or `/signup` redirects to `/app/dashboard`.

`Profile/index.jsx` resolves `targetId` as `useParams().userId ?? currentUser.id` — so `/app/profile` (no param)
always resolves the authenticated user's own id, `/app/profile/:userId` resolves whichever id is in the URL, and
`isOwnProfile = targetId === currentUser.id` drives the edit-vs-message-button UI split. No user id is ever
hardcoded. A genuinely nonexistent id still correctly renders the "Profile not found" `EmptyState`.

## Progress

### Original build (Phases 1–9) + dark editorial redesign — historical, done
The app went through an original light-mode build (Phases 1–9 in the blueprint's numbering), then a full dark
editorial/cinematic redesign of every screen. Both are complete history at this point — current code no longer
resembles either visually. `services/http.js` (the real-API swap) has still never been started; all services are
100% mock.

### Light redesign — "Open Call" (in progress — Phases 1–3 done)
- [x] **Phase 1 — Design Foundation**: new light token system (bare names aliased from every pre-existing `--c-*`
  token), typography foundation (Instrument Serif/Sans, EB Garamond, JetBrains Mono), new radius/shadow scale,
  motion primitives (`fadeRise`/`springScale`/`pageEntrance`), reusable creative wrappers (`SignalMark`,
  `FloatingCard`, `StaggerReveal`, `AnimatedCounter`, `HandUnderline`), several pink-foreground-on-light-bg
  contrast fixes the palette flip exposed, `color-scheme: light`. Official logo integrated app-wide shortly after
  (Navbar/Footer/AppLayout), ahead of Landing.
- [x] **Phase 2 — Landing Page**: asymmetric hero (oversized Instrument Serif, two-sided `HeroSignal` graphic),
  `FlowSection` rebuilt as a one-shot animated ASK→MATCH→RESPOND→COMPARE→CONNECT product-story sequence
  (`SignalMark`-based, no longer the shared `SignalRail` atom — that's now Help-page-only), new
  `ReverseMarketplaceSection`, `SampleAsksSection` wired to real `askService`/`authService` data with cursor-tilt
  cards, `CategoriesSection` as a spring/stagger chip cluster, `CtaSection` moved to a blush surface with the
  official logo. `ValuePropsSection` left untouched (already correct under the light tokens). Follow-up bug-fix
  pass: fixed `SampleAsksSection` rendering a large permanent blank area (the `useInView` ref was attached to
  content that only mounted after the async data load resolved, so the IntersectionObserver never attached and
  the stagger animation's `hidden` state — `opacity: 0` — never cleared; fixed by moving the ref to an
  always-mounted wrapper, plus added an `EmptyState` fallback for a genuinely-empty result), fixed the Footer
  logo rendering stretched (a column flex parent's default `align-items: stretch` was distorting it — added
  `align-self: flex-start`), and removed "Home services"/"Errands" from `mocks/categories.js` and recategorized/
  removed the sample asks that used them (see "Marketplace positioning" above).
- [x] **Phase 3 — App Shell**: sidebar redesigned from a full-bleed dark rail into a floating light panel (inset,
  rounded, soft shadow); nav active state is a blush pill + spring-animated red dot (the old vertical gradient
  rail indicator and icon glow filter were removed); Create ASK is a pill-shaped button with spring hover/press
  motion; desktop top bar's frosted background fixed from a leftover hardcoded dark rgba to a warm-light
  equivalent, search softened to a borderless pill; mobile tab bar active state is a blush icon pill; small spring
  "pop" added to all three unread badges (sidebar, bell, tab bar); sidebar plays a one-shot fade+slide entrance.
  Premium teaser/drawer redesigned in the same spirit as a follow-up: `UpgradeTeaser` went from a
  dismissible/collapsible card to an always-visible right-edge peek tab (see "Premium" above), and its trigger now
  opens `PremiumDrawer` (built on the new generic `Drawer` atom) instead of the old centered `PremiumModal`, which
  was deleted.
- [ ] 4. Core product loop (Discover ASKs, ASK Details, Create ASK + AI Ask Assistant, Respond to ASK) — **next;
  not started; wait for explicit instruction**
- [ ] 5. Dashboard + Payments & Milestones
- [ ] 6. Contract + Inbox
- [ ] 7. Profile + Premium + Help
- [ ] 8. Motion polish + full QA

### Latest bug fix — Profile "not found" for the current user (fixed)
Reported symptom: opening `/app/profile` showed "Profile not found" for the logged-in user. Root cause:
`authService.js`'s `users` array was a plain module-level import from `mocks/users.js`, holding only the 3 seeded
accounts; `login()`/`signup()` pushed any other account into that array only in memory, so a page reload reset it
back to the 3 seeded accounts while `AuthContext`'s separate `uask.auth.user` localStorage key still correctly
remembered the user as logged in — `getUserById(currentUser.id)` then returned `null` for anyone who wasn't one of
the 3 seeded accounts. Fixed by making `authService.js`'s `users` array itself localStorage-persistent (see
"Architecture rules" and "Auth" above). The routing (`targetId = useParams().userId ?? currentUser.id`) was
already correct and untouched. Verified: own profile resolves (including after refresh), viewing another user's
profile is unaffected, a genuinely invalid id still shows "Profile not found," no user id is hardcoded, and
`Profile/index.jsx` still only calls the service layer.

## Architecture rules to preserve

- Pages/components must never import raw mocks directly — `services/` remains the only data boundary.
- Preserve existing routes and product logic unless a task absolutely requires changing them.
- No backend/API swap yet.
- No real AI integration yet (AI Ask Assistant, AI Proposal Assistant, AI Matching are all UI-facing concepts only, unbuilt or mock) — AI Ask Assistant is explicitly Phase 4 scope, not built yet.
- No real payment gateway yet (Premium's "Upgrade" flow and all contract/milestone "payment" actions are mock/simulated).
- Don't redo completed phases/functionality unless explicitly asked.
- Don't reintroduce home-services/errands/chore-style categories or examples — see "Marketplace positioning" above.

## Workflow rules

- Work **one phase (or sub-phase) at a time** — don't jump ahead or bundle multiple phases into one change.
- **Don't redo completed phases** unless explicitly asked to.
- **Stop after the requested phase/sub-phase** and report what changed — don't keep going into the next one unprompted. Phase 4 specifically requires explicit instruction before starting.
- **Backend/API integration has not started.** The frontend is still 100% mock-driven — the real-API swap is not yet requested. Don't begin it unprompted.
- **Don't begin redesign work** on already-redesigned phases/screens (Landing, app shell), and don't modify app code, unless a specific task explicitly calls for it.
- **Standing cadence:** implement → the user manually tests in a real browser → `npm run build` → `npm run lint` → `git status` → commit → push → move to the next phase (only once explicitly requested). Keep phases small; don't bundle large, unrelated changes into a single step.
- **Browser testing is the user's responsibility.** They test manually; don't rely on or attempt to use the Claude in Chrome extension for this project's verification unless explicitly asked to.
