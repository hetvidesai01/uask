import styles from './SignalMark.module.css'

// The UASK broadcast/signal motif — a central red dot with optional
// radiating rings. Reusable wherever the app needs a small brand mark:
// loading, empty states, milestones, status paths, hero graphics,
// Profile Booster. Purely decorative — always aria-hidden; pair it with
// visible or screen-reader text of your own.
//
// `animated` plays a single reveal (rings fade/scale in once on mount) —
// deliberately NOT a loop, per the product's "no infinite/looping
// animation" rule. `prefers-reduced-motion` disables the reveal outright.
export default function SignalMark({ size = 'md', rings = 2, animated = false, className = '' }) {
  const ringCount = Math.min(Math.max(rings, 0), 3)

  const classes = [styles.mark, styles[size] || styles.md, animated ? styles.animated : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} aria-hidden="true">
      {Array.from({ length: ringCount }, (_, index) => (
        <span key={index} className={styles.ring} style={{ '--ring-index': index }} />
      ))}
      <span className={styles.dot} />
    </span>
  )
}
