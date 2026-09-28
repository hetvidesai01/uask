import { Link } from 'react-router-dom'
import Avatar from '../../ui/Avatar'
import Card from '../../ui/Card'
import Tag from '../../ui/Tag'
import ConnectButton from '../ConnectButton'
import { getProfileHeadline } from '../../../utils/profileHeadline'
import styles from './PersonCard.module.css'

// Keep it to the essentials the spec calls for — avatar, name, headline,
// a couple of skills, rating, completed-contract count, Connect. No bio
// excerpt, no activity feed, nothing that starts to read as a social card.
export default function PersonCard({ user, rating, completedContractCount, currentUserId, onConnectionChange }) {
  const headline = getProfileHeadline(user)
  const skills = (user.categories ?? []).slice(0, 3)
  const isProvider = user.roles?.includes('provider')

  return (
    <Card hoverable padding="lg" className={styles.card}>
      <Link to={`/app/profile/${user.id}`} className={styles.identity}>
        <Avatar src={user.avatarUrl} name={user.name} size="lg" />
        <div className={styles.info}>
          <span className={styles.name}>{user.name}</span>
          <span className={styles.headline}>{headline}</span>
        </div>
      </Link>

      {skills.length > 0 && (
        <div className={styles.skills}>
          {skills.map((skill) => (
            <Tag key={skill}>{skill}</Tag>
          ))}
        </div>
      )}

      <div className={styles.meta}>
        <span className={styles.rating}>
          {rating != null ? `★ ${rating.toFixed(1)}` : 'No rating yet'}
        </span>
        {isProvider && completedContractCount > 0 && (
          <>
            <span className={styles.dot} aria-hidden="true">
              &middot;
            </span>
            <span>
              {completedContractCount} completed {completedContractCount === 1 ? 'contract' : 'contracts'}
            </span>
          </>
        )}
      </div>

      <div className={styles.action}>
        <ConnectButton currentUserId={currentUserId} targetUserId={user.id} onChange={onConnectionChange} />
      </div>
    </Card>
  )
}
