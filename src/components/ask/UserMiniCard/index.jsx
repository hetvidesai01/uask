import { Link } from 'react-router-dom'
import Avatar from '../../ui/Avatar'
import styles from './UserMiniCard.module.css'

export default function UserMiniCard({ user, label }) {
  if (!user) return null

  return (
    <Link to={`/app/profile/${user.id}`} className={styles.card}>
      <Avatar src={user.avatarUrl} name={user.name} size="md" />
      <div className={styles.info}>
        {label && <span className={styles.label}>{label}</span>}
        <span className={styles.name}>{user.name}</span>
        <span className={styles.meta}>
          {user.rating != null && (
            <>
              ★ {user.rating.toFixed(1)}
              {user.reviewCount ? ` (${user.reviewCount})` : ''}
              <span aria-hidden="true"> &middot; </span>
            </>
          )}
          {user.location}
        </span>
      </div>
    </Link>
  )
}
