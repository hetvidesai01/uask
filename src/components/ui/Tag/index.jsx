import styles from './Tag.module.css'

export default function Tag({ children, onRemove }) {
  return (
    <span className={styles.tag}>
      {children}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={`Remove ${children}`}
        >
          ✕
        </button>
      )}
    </span>
  )
}
