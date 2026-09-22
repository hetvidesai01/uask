// Reusable Framer Motion variants for the dark editorial redesign.
// Foundation only — not wired into any page yet (Phase 12+ does that).
// Every consumer sits inside the app-level <MotionConfig reducedMotion="user">
// (see main.jsx), so these automatically collapse to instant when the user
// has "reduce motion" on — no per-variant reduced-motion branching needed.

const EASE_OUT = [0.16, 1, 0.3, 1]

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
}

export const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
}

// Pair with a wrapper that has `overflow: hidden` so the line clips in from
// below rather than just fading — used for headline/section-title reveals.
export const lineReveal = {
  hidden: { opacity: 0, y: '100%' },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
}

export const cardEntrance = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

// Restrained — small translate only, no scale/tilt, per the brand's
// "not too many animations" rule.
export const hoverLift = {
  rest: { y: 0 },
  hover: { y: -4, transition: { duration: 0.2, ease: 'easeOut' } },
}
