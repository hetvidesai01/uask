import { Link } from 'react-router-dom'
import EmptyState from '../../components/ui/EmptyState'
import { formatRelativeDate } from '../../utils/formatDate'
import styles from './ActivityFeed.module.css'

export default function ActivityFeed({ items }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="🕓"
        title="No activity yet"
        message="Post an ASK or respond to one — your activity will show up here."
      />
    )
  }

  return (
    <ul className={styles.feed}>
      {items.map((item) => (
        <li key={item.id} className={styles.item}>
          <span className={styles.icon} aria-hidden="true">
            {item.icon}
          </span>
          <span className={styles.text}>
            {item.text}
            <Link to={item.to} className={styles.link}>
              {item.linkText}
            </Link>
          </span>
          <span className={styles.time}>{formatRelativeDate(item.date)}</span>
        </li>
      ))}
    </ul>
  )
}
