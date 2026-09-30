import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { revealItem, SNAPPY_SPRING } from '../../../utils/motion'
import { formatRelativeDate } from '../../../utils/formatDate'
import styles from './NotificationItem.module.css'

const TYPE_ICONS = {
  offer_received: '📨',
  offer_shortlisted: '⭐',
  offer_accepted: '✅',
  offer_rejected: '✕',
  message: '💬',
  ask_matched: '🔔',
  ask_update: '🔔',
}

export default function NotificationItem({ notification, onMarkRead }) {
  const icon = TYPE_ICONS[notification.type] ?? '🔔'
  const classes = [styles.row, !notification.read ? styles.unread : ''].filter(Boolean).join(' ')

  const body = (
    <div className={styles.content}>
      <div className={styles.topRow}>
        <span className={styles.title}>{notification.title}</span>
        <span className={styles.time}>{formatRelativeDate(notification.createdAt)}</span>
      </div>
      <p className={styles.text}>{notification.body}</p>
    </div>
  )

  return (
    <motion.li className={classes} variants={revealItem} whileHover={{ y: -1 }} transition={SNAPPY_SPRING}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>

      {notification.link ? (
        <Link to={notification.link} className={styles.link} onClick={() => onMarkRead(notification.id)}>
          {body}
        </Link>
      ) : (
        body
      )}

      {notification.read ? (
        <span className={styles.dotSpacer} aria-hidden="true" />
      ) : (
        <motion.button
          type="button"
          className={styles.dot}
          onClick={() => onMarkRead(notification.id)}
          aria-label="Mark as read"
          title="Mark as read"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          whileHover={{ scale: 1.25 }}
          transition={SNAPPY_SPRING}
        />
      )}
    </motion.li>
  )
}
