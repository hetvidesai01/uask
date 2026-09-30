import { motion } from 'framer-motion'
import Button from '../../components/ui/Button'
import ContractStatusBadge from '../../components/contract/ContractStatusBadge'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../utils/formatDate'
import { revealGroupCalm as revealGroup, revealItemCalm as revealItem, SNAPPY_SPRING } from '../../utils/motion'
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

// Vertical signal path: each dot springs when its milestone is paid, and the
// line below it "fills" downward (scaleY) to show progress reached.
export default function MilestoneTimeline({ milestones, currency, isOwner, isProvider, onAction, actioningId }) {
  return (
    <motion.ol className={styles.timeline} initial="hidden" animate="visible" variants={revealGroup}>
      {milestones.map((milestone, index) => {
        const done = milestone.status === 'paid'
        return (
          <motion.li
            key={milestone.id}
            className={[styles.timelineItem, done ? styles.timelineItemDone : ''].filter(Boolean).join(' ')}
            variants={revealItem}
          >
            <div className={styles.timelineMarker}>
              <motion.span
                className={[styles.timelineDot, done ? styles.timelineDotDone : ''].filter(Boolean).join(' ')}
                initial={false}
                animate={{ scale: done ? 1.25 : 1 }}
                transition={SNAPPY_SPRING}
              />
              {index < milestones.length - 1 && (
                <span className={styles.timelineLine}>
                  <motion.span
                    className={styles.timelineLineFill}
                    initial={false}
                    animate={{ scaleY: done ? 1 : 0 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 24 }}
                  />
                </span>
              )}
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
          </motion.li>
        )
      })}
    </motion.ol>
  )
}
