import { motion } from 'framer-motion'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { PAYMENT_STAGES, getStageDisplayStatus } from '../../utils/contractMath'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../utils/formatDate'
import { revealGroupCalm, revealItemCalm } from '../../utils/motion'
import styles from './ContractParts.module.css'

const STAGE_STATUS = {
  not_due: { variant: 'closed', label: 'Not Due' },
  due: { variant: 'open', label: 'Due' },
  awaiting_approval: { variant: 'in_review', label: 'Awaiting Approval' },
  paid: { variant: 'accepted', label: 'Paid' },
  disputed: { variant: 'rejected', label: 'Disputed' },
}

function stageHint(contract, stage, display, role) {
  if (display === 'paid') return stage.paidAt ? `Marked as paid ${formatAbsoluteDate(stage.paidAt)}` : 'Marked as paid'
  if (display === 'disputed') return 'On hold while the contract is disputed.'
  if (display === 'awaiting_approval') {
    return role === 'seeker' ? 'Review the submitted work in Project Progress.' : 'Waiting for the ASK Side to approve.'
  }
  if (display === 'due') {
    return role === 'seeker' ? 'Ready to be marked as paid.' : 'Waiting for the ASK Side to mark this as paid.'
  }
  if (contract.status === 'draft' || contract.status === 'awaiting_signatures') return 'Starts once both parties sign.'
  return `Due ${formatAbsoluteDate(stage.dueDate)}`
}

export default function PaymentSchedule({ contract, role, onPay, busyKey, boosterPct }) {
  const stages = PAYMENT_STAGES.map((def) => ({
    def,
    stage: contract.milestones.find((m) => m.stage === def.key),
  }))
  const paidPct = stages.reduce((sum, { def, stage }) => sum + (stage.status === 'paid' ? def.percent : 0), 0)

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Payment schedule · 25–50–25</h2>
        <span className={styles.metaText}>{paidPct}% marked as paid</span>
      </div>

      <div className={styles.segmentBar} aria-hidden="true">
        {stages.map(({ def, stage }) => (
          <span
            key={def.key}
            className={[styles.segment, stage.status === 'paid' ? styles.segmentPaid : ''].filter(Boolean).join(' ')}
            style={{ flexGrow: def.percent }}
          />
        ))}
      </div>

      <motion.ol className={styles.stageGrid} initial="hidden" animate="visible" variants={revealGroupCalm}>
        {stages.map(({ def, stage }) => {
          const display = getStageDisplayStatus(contract, stage)
          const status = STAGE_STATUS[display]
          const canPay =
            role === 'seeker' && display === 'due' && contract.status === 'active'
          return (
            <motion.li key={def.key} className={styles.stage} variants={revealItemCalm}>
              <div className={styles.stageTop}>
                <span className={styles.stagePercent}>{def.percent}%</span>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <p className={styles.stageLabel}>{def.label}</p>
              <p className={styles.stageAmount}>{formatCurrency(stage.amount, contract.currency)}</p>
              <p className={styles.stageTrigger}>{def.trigger}</p>
              <p className={styles.stageHint}>{stageHint(contract, stage, display, role)}</p>
              {canPay && (
                <Button size="sm" loading={busyKey === `pay-${def.key}`} onClick={() => onPay(def.key)}>
                  Mark as paid (demo)
                </Button>
              )}
            </motion.li>
          )
        })}
      </motion.ol>

      {boosterPct != null && <p className={styles.booster}>Profile Booster +{boosterPct}%</p>}
      <p className={styles.demoNote}>Demo payment flow — no real transaction</p>
    </div>
  )
}
