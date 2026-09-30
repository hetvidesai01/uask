import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { SNAPPY_SPRING } from '../../../utils/motion'
import Avatar from '../../ui/Avatar'
import { formatRelativeDate } from '../../../utils/formatDate'
import styles from './ThreadListItem.module.css'

export default function ThreadListItem({ thread, participant, ask, isActive }) {
  const hasUnread = thread.unreadCount > 0

  const classes = [styles.item, isActive ? styles.active : '', hasUnread ? styles.unread : '']
    .filter(Boolean)
    .join(' ')

  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} transition={SNAPPY_SPRING}>
    <Link to={`/app/inbox/messages/${thread.id}`} className={classes} aria-current={isActive ? 'true' : undefined}>
      {isActive && (
        <motion.span
          layoutId="thread-active-bg"
          className={styles.activePill}
          transition={SNAPPY_SPRING}
          aria-hidden="true"
        />
      )}
      <Avatar src={participant?.avatarUrl} name={participant?.name ?? '?'} size="md" />

      <div className={styles.body}>
        <div className={styles.topRow}>
          <span className={styles.name}>{participant?.name ?? 'Unknown user'}</span>
          <span className={styles.time}>{formatRelativeDate(thread.updatedAt)}</span>
        </div>

        {ask && <span className={styles.askTag}>{ask.title}</span>}

        <p className={styles.preview}>{thread.lastMessage}</p>
      </div>

      <AnimatePresence>
        {hasUnread && (
          <motion.span
            key={thread.unreadCount}
            className={styles.badge}
            aria-label={`${thread.unreadCount} unread messages`}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.25, 1] }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {thread.unreadCount}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
    </motion.div>
  )
}
