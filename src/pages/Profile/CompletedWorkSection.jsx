import { Link } from 'react-router-dom'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../utils/formatDate'
import styles from './CompletedWorkSection.module.css'

export default function CompletedWorkSection({ items }) {
  return (
    <div className={styles.list}>
      {items.map((item) => (
        <div key={item.id} className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderText}>
              <p className={styles.eyebrow}>{item.askCategory ?? 'Project'}</p>
              <Link to={`/app/asks/${item.askId}`} className={styles.title}>
                {item.askTitle}
              </Link>
            </div>
            <span className={styles.value}>{formatCurrency(item.agreedPrice, item.currency)}</span>
          </div>

          <p className={styles.meta}>
            With <strong>{item.clientName}</strong>
            {item.completedAt && <> &middot; Completed {formatAbsoluteDate(item.completedAt)}</>}
          </p>

          <div className={styles.footerRow}>
            <span className={styles.milestones}>
              {item.paidMilestoneCount} / {item.totalMilestoneCount} milestones completed
            </span>
            {item.rating != null ? (
              <span className={styles.rating}>★ {item.rating.toFixed(1)} / 5</span>
            ) : (
              <span className={styles.awaiting}>Awaiting rating</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
