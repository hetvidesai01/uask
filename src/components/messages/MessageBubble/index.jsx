import { formatRelativeDate } from '../../../utils/formatDate'
import styles from './MessageBubble.module.css'

export default function MessageBubble({ message, isOwn, grouped, showTime }) {
  const classes = [styles.row, isOwn ? styles.own : styles.received, grouped ? styles.grouped : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <div className={styles.bubble}>
        <p className={styles.body}>{message.body}</p>
      </div>
      {showTime && <span className={styles.time}>{formatRelativeDate(message.createdAt)}</span>}
    </div>
  )
}
