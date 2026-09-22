import Button from '../../components/ui/Button'
import ContractStatusBadge from '../../components/contract/ContractStatusBadge'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../utils/formatDate'
import styles from './Contract.module.css'

function MilestoneActions({ milestone, isOwner, isProvider, onAction, busy }) {
  if (isProvider && (milestone.status === 'upcoming' || milestone.status === 'in_progress')) {
    return (
      <Button size="sm" variant="secondary" loading={busy} onClick={() => onAction(milestone.id, 'submitted')}>
        Mark as submitted
      </Button>
    )
  }
  if (isOwner && milestone.status === 'submitted') {
    return (
      <Button size="sm" variant="secondary" loading={busy} onClick={() => onAction(milestone.id, 'approved')}>
        Approve milestone
      </Button>
    )
  }
  if (isOwner && milestone.status === 'approved') {
    return (
      <Button size="sm" loading={busy} onClick={() => onAction(milestone.id, 'paid')}>
        Mark payment as paid
      </Button>
    )
  }
  return null
}

export default function MilestoneTimeline({ milestones, currency, isOwner, isProvider, onAction, actioningId }) {
  return (
    <ol className={styles.timeline}>
      {milestones.map((milestone, index) => (
        <li key={milestone.id} className={styles.timelineItem}>
          <div className={styles.timelineMarker}>
            <span
              className={[styles.timelineDot, milestone.status === 'paid' ? styles.timelineDotDone : '']
                .filter(Boolean)
                .join(' ')}
            />
            {index < milestones.length - 1 && <span className={styles.timelineLine} />}
          </div>

          <div className={styles.timelineContent}>
            <div className={styles.timelineTop}>
              <p className={styles.timelineTitle}>{milestone.title}</p>
              <ContractStatusBadge status={milestone.status} />
            </div>
            <p className={styles.timelineDescription}>{milestone.description}</p>
            <div className={styles.timelineMeta}>
              <span className={styles.timelineAmount}>{formatCurrency(milestone.amount, currency)}</span>
              <span className={styles.timelineDue}>Due {formatAbsoluteDate(milestone.dueDate)}</span>
            </div>
            <div className={styles.timelineActions}>
              <MilestoneActions
                milestone={milestone}
                isOwner={isOwner}
                isProvider={isProvider}
                onAction={onAction}
                busy={actioningId === milestone.id}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
