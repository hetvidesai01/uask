import { Link } from 'react-router-dom'
import Card from '../../ui/Card'
import AskStatusBadge from '../AskStatusBadge'
import { formatBudgetRange } from '../../../utils/formatCurrency'
import { formatRelativeDate } from '../../../utils/formatDate'
import styles from './AskCard.module.css'

export default function AskCard({ ask }) {
  return (
    <Link to={`/app/asks/${ask.id}`} className={styles.link}>
      <Card hoverable className={styles.card}>
        <div className={styles.top}>
          <span className={styles.category}>{ask.category}</span>
          <AskStatusBadge status={ask.status} />
        </div>

        <h3 className={styles.title}>{ask.title}</h3>
        <p className={styles.description}>{ask.description}</p>

        <div className={styles.meta}>
          <span className={styles.budget}>
            {formatBudgetRange(ask.budgetMin, ask.budgetMax, ask.currency)}
          </span>
          <span className={styles.dot} aria-hidden="true">
            &middot;
          </span>
          <span>{ask.isRemote ? 'Remote' : ask.location}</span>
        </div>

        <div className={styles.footer}>
          <span>
            {ask.responseCount} {ask.responseCount === 1 ? 'response' : 'responses'}
          </span>
          <span>{formatRelativeDate(ask.createdAt)}</span>
        </div>
      </Card>
    </Link>
  )
}
