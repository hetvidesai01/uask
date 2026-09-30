import { motion } from 'framer-motion'
import { SOFT_SPRING } from '../../../utils/motion'
import { formatRelativeDate } from '../../../utils/formatDate'
import styles from './MessageBubble.module.css'

// `isNew` is true only for a message added during this session (just sent),
// so the existing history never re-animates on render.
export default function MessageBubble({ message, isOwn, grouped, showTime, isNew = false }) {
  const classes = [styles.row, isOwn ? styles.own : styles.received, grouped ? styles.grouped : '']
    .filter(Boolean)
    .join(' ')

  return (
    <motion.div
      className={classes}
      initial={isNew ? { opacity: 0, y: 10, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SOFT_SPRING}
    >
      <div className={styles.bubble}>
        <p className={styles.body}>{message.body}</p>
      </div>
      {showTime && <span className={styles.time}>{formatRelativeDate(message.createdAt)}</span>}
    </motion.div>
  )
}
