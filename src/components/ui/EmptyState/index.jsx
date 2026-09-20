import styles from './EmptyState.module.css'

export default function EmptyState({ icon, title, message, action }) {
  return (
    <div className={styles.empty}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {title && <p className={styles.title}>{title}</p>}
      {message && <p className={styles.message}>{message}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
