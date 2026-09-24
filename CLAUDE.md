# UASK — Frontend

Full spec lives in `UASK_FRONTEND_BLUEPRINT.md`. Read that first for anything not covered here — this file is the quick-context summary, that file is the source of truth for detailed specs (route map, component prop tables, exact token values, build order). **Note:** the blueprint's own §5 "Design system" section describes the *original light-mode* palette and button/badge treatments — that was superseded by the dark editorial redesign (see below). The token values, button variants, and badge colors documented in *this* file reflect the current, actual state; treat the blueprint as historical/structural reference only for anything visual.

## What UASK is

A **reverse marketplace**: users post what they need (an "ASK") and relevant providers respond with offers, instead of searching a catalog of listings.

**Core flow:** `ASK → MATCH → RESPOND → COMPARE → CONNECT`

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
- [x] Premium/Upgrade experience — Basic vs Premium comparison, right-side Premium teaser
- [x] Help Center + guided onboarding
- [x] Profile & reputation upgrade — ratings out of 5, reviews, completed contract history, portfolio mock section
- [ ] **AI Ask Assistant** — mentioned in Help's guide copy and the onboarding tour as a planned capability, but
  **not implemented** in Create ASK yet (verified against the code — nothing AI-related exists under
  `pages/CreateAsk/`). Don't assume it exists; build it fresh when that phase is actually requested.

### Important terminology
Use these terms consistently everywhere (normalized app-wide during the Phase 8 QA pass):
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
  Boosts, advanced analytics, smart alerts (full Basic-vs-Premium table lives in `components/premium/PremiumModal`)
- **No real billing/payment integration exists** — `subscriptionService.js` is a mock, localStorage-backed
  service; "Upgrade to Premium" is a simulated flow only

### Current visual state — IMPORTANT
The product currently ships the **dark editorial/cinematic redesign** described under "Design system — source of
truth" below — that section is still 100% accurate for the code as it exists right now.

**However, the user has decided to move away from that direction.** A new visual strategy — **"UASK Open
Call"** — has been approved *conceptually* (a full strategy document exists as a Claude Artifact from the planning
session that produced it): light, editorial, kinetic, youthful creative-tech; warm off-white canvas; strong
red/burgundy brand accents; more purposeful animation. It keeps all five existing brand hexes (`#D02727`,
`#992E34`, `#F7B4B4`, `#6E1414`, `#F0B8B8`) and moves the *neutral* palette from dark to a warm light system
(canvas ≈ `#FBF3EF`, surface ≈ `#FFFDFB`, blush ≈ `#F9DAD5`, ink ≈ `#241512`). Planned typography: **Instrument
Serif** + **Instrument Sans** as the new display/UI pair, **EB Garamond** kept selectively, **JetBrains Mono**
used selectively for data/numerals. Planned motifs: a signal/broadcast mark, floating layered cards, category
chips, asymmetric layouts, an occasional hand-marked underline, blush organic shapes. Planned motion: staggered
reveals, spring interactions, a magnetic CTA, cursor-reactive cards, animated counters, shared layout transitions,
spring milestone/progress animations, subtle page transitions — all respecting `prefers-reduced-motion`.

**Light Redesign Phase 1 (Design Foundation) is now done** — `styles/tokens.css` carries the new light token set
(bare names `--canvas`/`--surface`/`--blush`/`--blush-deep`/`--red`/`--red-deep`/`--burgundy`/`--pink`/
`--pink-tagline`/`--ink`/`--ink-mute`/`--ink-faint`/`--border`/`--border-strong`, plus `--shadow-card`/
`--shadow-lift`), with every pre-existing `--c-*` token aliased to it so the whole app inherited the light system
without a page-by-page rewrite. Typography tokens now point at Instrument Serif/Instrument Sans, with EB Garamond
and JetBrains Mono as separate selective tokens. New foundation-only pieces: `components/ui/SignalMark`
(broadcast-mark primitive), `FloatingCard`, `StaggerReveal`, `AnimatedCounter`, `HandUnderline`, and three new
motion variants (`fadeRise`, `springScale`, `pageEntrance` in `utils/motion.js`) — built in Phase 1, now put to
use in Phase 2 (below). The official logo (`src/assets/brand/uask.logo.png` — see "Brand assets") replaced the
text wordmark app-wide (Navbar/Footer/AppLayout sidebar+topbar) shortly after Phase 1, ahead of Landing itself.

**Light Redesign Phase 2 (Landing page) is now done.** The Landing page is fully redesigned for the light system —
asymmetric hero with oversized `Instrument Serif` type and a two-sided (`HeroSignal`) graphic showing both a
posted ASK and named providers responding; `FlowSection` (still `id="how-it-works"`) rebuilt as a one-shot
animated ASK→MATCH→RESPOND→COMPARE→CONNECT product story built from `SignalMark` + plain `motion.div`s (no
canvas/WebGL) that plays once via `useInView` and settles into a static "one offer connected" end state — it no
longer reuses the shared `SignalRail` atom (that atom is now Help-page-only, see "Folder structure" below); a new
`ReverseMarketplaceSection` contrasts the traditional flow against UASK's; `SampleAsksSection` now fetches real
sample ASKs through `askService.getAsks()` + `authService.getUserById()` (not a hand-duplicated fake array) and
renders them as cursor-tilt `TiltCard`s (a Landing-local component built directly on Framer's
`useMotionValue`/`useSpring`/`useTransform`, explicitly gated on `useReducedMotion()` since those imperative APIs
don't read `MotionConfig` automatically); `CategoriesSection` is a spring/stagger chip cluster sourced from
`askService.getCategories()`; `CtaSection` moved off the old dark `--c-red-dark` band onto a `--blush`→`--canvas`
gradient with the official logo and a primary "Create ASK" action. `ValuePropsSection` was left untouched — it
already read correctly under the light tokens. No stats/social-proof section was added — the pre-redesign Landing
page had none to preserve, and inventing numbers wasn't an option. **Do not assume any page beyond Landing has
been visually redesigned** — the app shell, dashboard, and every other screen still only look different because
their CSS is 100% token-driven and inherited the light palette from Phase 1; none of their layout, motion, or copy
has been touched yet. Planned implementation order:
1. ~~Light design foundation~~ — done
2. ~~Landing page~~ — done
3. App shell
4. Core product loop
5. Dashboard + Payments & Milestones
6. Contract + Inbox
7. Profile + Premium + Help
8. Motion polish + full QA

**Next task when resumed: Light Redesign Phase 3 — App shell.**

## Scope

**Frontend only, for now.** No backend, no database, no real API. All data is mock (`src/mocks/`) served through a service layer (`src/services/`) with artificial delays, designed to be swapped for real HTTP calls later without touching any page code.

## Tech stack

- React + Vite
- React Router (client-side routing, `BrowserRouter`)
- Plain CSS with **CSS Modules** (`Component.module.css`)
- **Framer Motion** — added during the dark editorial redesign for the motion system (page/section reveals, staggered groups, the landing "signal rail," count-up stats). Wired globally via `<MotionConfig reducedMotion="user">` in `main.jsx`, so every `motion.*` component automatically respects `prefers-reduced-motion`.

**Explicitly not used** unless the user asks for it later: Tailwind, TypeScript, Redux, a backend, a database.

## Design system — source of truth

> This section documents the **currently implemented** dark editorial system — still accurate for the code as it
> exists today. See "Current product state → Current visual state" above for the approved-but-not-yet-built
> "Open Call" light redesign direction; don't conflate the two.

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

## Brand assets

**Official logo:** `src/assets/brand/uask.logo.png` — a transparent-background PNG lockup ("Uask" wordmark + the
signal-dot motif already built into the "U," plus a baked-in tagline). This is the one official logo file; do not
redraw, re-export, crop, or otherwise modify it — resize only via CSS (`height` + `width: auto`) to preserve its
aspect ratio.

Rendered in place of a text "UASK" wordmark at every major brand position: the public `Navbar` (also covers the
Login/Signup auth screens, which have no logo of their own and rely on `Navbar` via `PublicLayout`), `Footer`,
`AppLayout`'s sidebar + mobile top bar (both instances), and (added in Light Redesign Phase 2) Landing's
`CtaSection`. Each usage is `<img src={uaskLogo} alt="UASK" ... />` — always keep the `alt="UASK"` text exactly
as-is. Textual mentions of "UASK" elsewhere (page copy, titles like
"UASK Premium," the footer copyright line, document `<title>`) stay as plain text — only standalone brand-mark
lockups get the image.

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
- Profile & Reputation (Product Change Phase 7): the reputation math (`getProviderReputation`, `getCompletedContractsForProvider`) lives in `contractService.js` — same simple milestone-based Profile Booster formula (`round(completedMilestones / totalMilestones * 20)`) already used on the Payments dashboard and the Contract page, not a new algorithm. It's scoped to contracts where the profile's owner is the provider; a plain mock-only Portfolio (`profileService.js` + `mocks/portfolio.js`, no upload flow) is separate from that. `Profile/index.jsx` only renders the reputation/reviews/completed-work/portfolio sections when the viewed profile has the `provider` role, and falls back to the profile's seeded `rating`/`reviewCount` for Average Rating whenever there's no rated completed contract yet, so the number stays consistent with `UserMiniCard`/`CompareResponses` elsewhere in the app rather than showing "— / 5" for most of the mock dataset.
- Page folder convention: `PageName/index.jsx` + `PageName.module.css`, plus any page-local sub-components in the same folder — e.g. `Landing/` (multi-section), `Dashboard/` (shell + `DashboardOverview` + `DashboardPayments` + `ActivityFeed` + `useCountUp`), `Inbox/` (shell + `Thread` + `NotificationsPanel`), `Contract/` (shell + `MilestoneTimeline` + `RatingForm`), `AskDetails/` (+ `StatusRail`).

## Folder structure (current)

```
src/
├─ main.jsx (wraps app in <MotionConfig reducedMotion="user">), App.jsx (route tree), index.css
├─ assets/            brand/uask.logo.png — official logo asset (see "Brand assets" below)
├─ styles/            tokens.css (light "Open Call" foundation), reset.css, base.css, utilities.css
├─ layouts/           PublicLayout, AppLayout (sidebar + desktop top bar + mobile shell), ProtectedRoute
├─ pages/             one folder per route (see App.jsx for the route map)
│  ├─ Landing/         Hero + HeroSignal (light redesign, Phase 2), FlowSection (animated product-story sequence,
│  │                   no longer the SignalRail atom), ReverseMarketplaceSection, ValueProps, SampleAsks (real
│  │                   data via askService/authService), Categories (chip cluster), Cta
│  ├─ Dashboard/        shell (nav switch) + DashboardOverview + DashboardPayments + ActivityFeed + useCountUp
│  ├─ AskDetails/       + StatusRail (compact ASK→MATCH→RESPOND→COMPARE→CONNECT progress rail)
│  ├─ Contract/         Contract summary/payment/milestones/rating screen + MilestoneTimeline + RatingForm
│  ├─ Inbox/            merged Messages + Notifications (tabs) + Thread + NotificationsPanel
│  ├─ Help/             HowItWorksSection (signal rail), GuideSection (shared, used for both guides), FaqSection (accordion), ProductTourCallout
│  ├─ Profile/          + ReputationMetrics, ReviewsSection, CompletedWorkSection, PortfolioSection (provider-only; Product Change Phase 7)
│  ├─ DesignPreview/    temporary, dev-only — inspects the dark token system; not linked from nav
│  └─ (Login, Signup, CreateAsk, DiscoverAsks, RespondToAsk, CompareResponses, NotFound — unchanged)
├─ components/
│  ├─ ui/              generic, reusable, no business logic (13 original + GrainOverlay/GradientMesh/SignalMark/
│  │                   FloatingCard/StaggerReveal/AnimatedCounter/HandUnderline — light-redesign foundation atoms)
│  ├─ layout/          Navbar (scroll-aware, renders the logo image), Footer (renders the logo image)
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
├─ services/            authService, askService, offerService, messageService, notificationService, contractService, subscriptionService, profileService
└─ mocks/               users, asks, offers, messages, notifications, categories, contracts, subscriptions, portfolio
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

### Light redesign — "Open Call" (in progress — Phase 1 done)
Full strategy — creative concept, color/typography/motion systems, screen-by-screen treatment — is in a Claude
Artifact from the planning session; summarized under "Current product state → Current visual state" above.
- [x] 1. Light design foundation — light token set (`tokens.css`) with `--c-*` back-compat aliases, typography
  tokens (Instrument Serif/Sans, EB Garamond, JetBrains Mono), new radius/shadow scale, `SignalMark`,
  `FloatingCard`/`StaggerReveal`/`AnimatedCounter`/`HandUnderline` wrappers, 3 new motion variants, contrast
  fixes for pink-foreground-on-light-bg bugs the palette flip exposed (Badge/AppLayout/PremiumModal/Landing
  kicker), `color-scheme: light`. Nothing page-specific was redesigned — see "Current visual state" above.
- [x] 2. Landing page — asymmetric hero (oversized Instrument Serif, two-sided `HeroSignal` graphic), `FlowSection`
  rebuilt as a one-shot animated ASK→MATCH→RESPOND→COMPARE→CONNECT sequence (`SignalMark`-based, no longer the
  shared `SignalRail` atom), new `ReverseMarketplaceSection`, `SampleAsksSection` wired to real
  `askService`/`authService` data with cursor-tilt cards, `CategoriesSection` as a spring/stagger chip cluster,
  `CtaSection` moved to a blush surface with the official logo. `ValuePropsSection` untouched (already correct).
  No stats section added (none existed to preserve).
- [ ] 3. App shell — **next task when resumed**
- [ ] 4. Core product loop
- [ ] 5. Dashboard + Payments & Milestones
- [ ] 6. Contract + Inbox
- [ ] 7. Profile + Premium + Help
- [ ] 8. Motion polish + full QA

### Product structure changes (see conversation history for the full 8-item plan; status below)
- [x] Unified Inbox — merged Messages + Notifications into `/app/inbox` (tabs), combined unread badge, old routes redirect
- [x] Dashboard restructuring — split into ASKs & Offers (`/app/dashboard`) and Payments & Milestones (`/app/dashboard/payments`) sub-routes with a real internal nav switch
- [x] Contract + Payment/Milestone flow — "View Contract" entry point from ASK Details once an offer is accepted, full Contract screen (summary/deliverables/payment summary/milestone timeline with role-based mock actions/completion/rating), feeds Dashboard's Revenue/Average Rating/Milestones metrics
- [ ] AI Ask Assistant (inside Create ASK) — not started
- [x] Premium/Upgrade screen — right-side `UpgradeTeaser` on all `/app/*` screens (collapsible, dismissible, fixed on desktop ≥1200px / inline banner below that) + `PremiumModal` (Basic vs Premium comparison, ₹149/mo or ₹999/yr, mock "Upgrade to Premium" flow via `subscriptionService`, no real billing)
- [x] Help section (replacing "How it works" in public nav; FAQs/guides) — `/help` (public route): How UASK Works (signal rail), Guide for ASK creators, Guide for providers, accordion FAQs, plus a "Restart Product Tour" control. Guided onboarding: `ProductTour` (5 steps — Discover/Create ASK/Inbox/Dashboard/Profile — Next/Back/Skip/Finish), auto-opens once per user in `AppLayout`, completion tracked in localStorage
- [x] Profile & Reputation Upgrade (Product Change Phase 7, supersedes the earlier "4.8 / 5" rating-format item) — Profile summary now leads with a prominent "4.8 / 5" rating + review count and a derived headline (`"{primary category} Provider"` / `"Seeker"`, read-only — no new editable field). Provider profiles additionally get: Reputation metrics (Average Rating, Completed Contracts, Total Revenue, Profile Booster with a non-ranking-guarantee info toggle), Reviews, Completed work / contract history, and a mock-only Portfolio with an empty state — all gated behind the `provider` role so a dual-role profile isn't duplicated, just extended
- [x] "Browse" → "Discover" wording pass (Navbar, Discover subtitle, Dashboard empty state, Landing categories heading)

### Product Change Phase 8 — Full Frontend QA + Consistency Pass (done)
Whole-app audit before backend/API integration — terminology, navigation, UI/dark-theme/motion consistency, responsive/empty-state/architecture hygiene. Findings and fixes are in conversation history; the concrete changes made:
- Unified the "create an ASK" entry point's label to **Create ASK** everywhere it's a literal nav element (sidebar button, mobile FAB, the `/app/asks/new` page's own `<h1>` — previously "+ New ASK" / "Post a new ASK" in three different places for the same destination). Narrative copy elsewhere ("Post an ASK" CTAs on Landing/Dashboard/Signup, "You posted…" activity feed text) was left as-is — that's consistent marketing/activity voice across itself, not a nav label, and rewriting it was judged out of scope for this pass.
- Two leftover "browse" verbs in Help's copy (a provider-guide step, an FAQ answer) reworded to match the canonical **Discover** terminology, now that "Browse ASKs" is fully retired.
- Extracted the duplicated "signal rail" markup/CSS (`Landing/FlowSection` and `Help/HowItWorksSection` had copy-pasted, near-identical implementations) into a shared `components/ui/SignalRail` atom — zero visual change, removes ~150 lines of duplication.
- Confirmed clean via static audit (no code changes needed): no hardcoded hex/light-theme colors outside `tokens.css`, no broken `Link`/`navigate` targets, no pages importing `mocks/` directly, no dead page/component files, no unconditional fixed-width (≥300px) CSS that could force mobile overflow, no animation loops/scroll-linked parallax/3D tilt outside the intentional `Spinner`.

## Architecture rules to preserve

- Pages/components must never import raw mocks directly — `services/` remains the only data boundary.
- Preserve existing routes and product logic unless a task absolutely requires changing them.
- No backend/API swap yet.
- No real AI integration yet (AI Ask Assistant, AI Proposal Assistant, AI Matching are all UI-facing concepts only, unbuilt or mock).
- No real payment gateway yet (Premium's "Upgrade" flow and all contract/milestone "payment" actions are mock/simulated).
- Don't redo completed functionality unless explicitly asked.

## Workflow rules

- Work **one phase (or sub-phase) at a time** — don't jump ahead or bundle multiple phases into one change.
- **Run and test before continuing** (`npm run build`, then exercise the feature in a real browser — don't just eyeball the code).
- **Don't redo completed phases** unless explicitly asked to.
- **Stop after the requested phase/sub-phase** and report what changed — don't keep going into the next one unprompted.
- **Backend/API integration has not started.** The frontend is still 100% mock-driven — Phase 10 (`services/http.js`, real API) is next but not yet requested. Don't begin it unprompted.
- **Don't begin redesign work** on completed phases/screens, and don't modify app code, unless a specific task explicitly calls for it — preserve the current UASK brand system and existing functionality as-is. (This applies to the *implemented* dark editorial system; the approved-but-unbuilt "Open Call" light redesign is the one exception once its phases are actually requested — see "Current visual state" above.)
- **Standing cadence:** implement → test locally → `git status` → commit → push → move to the next phase. Keep phases small; don't bundle large, unrelated changes into a single step.
