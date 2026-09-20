import styles from './StatCard.module.css'

export default function StatCard({ label, value, delta }) {
  const isNegative = typeof delta === 'number' && delta < 0
  const deltaText =
    typeof delta === 'number' ? `${delta > 0 ? '+' : ''}${delta}%` : delta

  return (
    <div className={styles.card}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {delta !== undefined && (
        <span className={[styles.delta, isNegative ? styles.negative : styles.positive].join(' ')}>
          {deltaText}
        </span>
      )}
    </div>
  )
}
