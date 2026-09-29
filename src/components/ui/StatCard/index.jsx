import styles from './StatCard.module.css'

// `icon` is optional and purely decorative (aria-hidden) — kept small and
// secondary to the number itself, not a replacement for the label.
export default function StatCard({ label, value, delta, icon }) {
  const isNegative = typeof delta === 'number' && delta < 0
  const deltaText =
    typeof delta === 'number' ? `${delta > 0 ? '+' : ''}${delta}%` : delta

  return (
    <div className={styles.card}>
      <span className={styles.labelRow}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <span className={styles.label}>{label}</span>
      </span>
      <span className={styles.value}>{value}</span>
      {delta !== undefined && (
        <span className={[styles.delta, isNegative ? styles.negative : styles.positive].join(' ')}>
          {deltaText}
        </span>
      )}
    </div>
  )
}
