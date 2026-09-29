import styles from './MatchBadge.module.css'

// Compact score + label pill — intentionally plain (no gradients, no
// robot/sparkle iconography, no fake decimal precision). `score` is
// already a rounded 0-100 int from matchingService.
export default function MatchBadge({ score, label, size = 'md' }) {
  return (
    <span className={[styles.badge, styles[size]].filter(Boolean).join(' ')}>
      <span className={styles.score}>{score}</span>
      <span className={styles.label}>{label}</span>
    </span>
  )
}
