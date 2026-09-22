import { Link } from 'react-router-dom'
import Avatar from '../../ui/Avatar'
import { formatRelativeDate } from '../../../utils/formatDate'
import styles from './ThreadListItem.module.css'

export default function ThreadListItem({ thread, participant, ask, isActive }) {
  const hasUnread = thread.unreadCount > 0

  const classes = [styles.item, isActive ? styles.active : '', hasUnread ? styles.unread : '']
    .filter(Boolean)
    .join(' ')

  return (
    <Link to={`/app/inbox/messages/${thread.id}`} className={classes} aria-current={isActive ? 'true' : undefined}>
      <Avatar src={participant?.avatarUrl} name={participant?.name ?? '?'} size="md" />

      <div className={styles.body}>
        <div className={styles.topRow}>
          <span className={styles.name}>{participant?.name ?? 'Unknown user'}</span>
          <span className={styles.time}>{formatRelativeDate(thread.updatedAt)}</span>
        </div>

        {ask && <span className={styles.askTag}>{ask.title}</span>}

        <p className={styles.preview}>{thread.lastMessage}</p>
      </div>

      {hasUnread && (
        <span className={styles.badge} aria-label={`${thread.unreadCount} unread messages`}>
          {thread.unreadCount}
        </span>
      )}
    </Link>
  )
}
