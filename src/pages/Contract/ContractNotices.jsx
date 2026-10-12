import Button from '../../components/ui/Button'
import { OWNERSHIP_OPTIONS, PORTFOLIO_OPTIONS, labelFor } from '../../utils/contractMath'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatAbsoluteDate, formatAbsoluteDateTime } from '../../utils/formatDate'
import styles from './ContractParts.module.css'

const KIND_TITLE = {
  edit: 'Proposed contract change',
  amendment: 'Proposed amendment',
  dispute_correction: 'Proposed dispute correction',
}

const sideName = (role) => (role === 'seeker' ? 'ASK Side' : 'Respond Side')

function describe(key, value, contract) {
  switch (key) {
    case 'scope':
      return ['Scope', value]
    case 'deadline':
      return ['Deadline', formatAbsoluteDate(value)]
    case 'revisionsIncluded':
      return ['Included revisions', String(value)]
    case 'agreedPrice':
      return ['Agreed price', formatCurrency(value, contract.currency)]
    case 'ownership':
      return ['Deliverable ownership', labelFor(OWNERSHIP_OPTIONS, value)]
    case 'portfolioPermission':
      return ['Portfolio permission', labelFor(PORTFOLIO_OPTIONS, value)]
    case 'confidentiality':
      return ['Confidentiality', value ? 'Agreed' : 'Not requested']
    default:
      return [key, String(value)]
  }
}

export function PendingChangeCard({ contract, role, onRespond, busyKey }) {
  const pending = contract.pendingChange
  const mine = pending.proposedBy === role

  return (
    <div className={styles.notice}>
      <p className={styles.noticeTitle}>
        {KIND_TITLE[pending.kind]} · by {sideName(pending.proposedBy)}
      </p>
      <ul className={styles.changeList}>
        {Object.entries(pending.changes).map(([key, value]) => {
          const [label, text] = describe(key, value, contract)
          return (
            <li key={key}>
              <span>{label}</span> {text}
            </li>
          )
        })}
      </ul>
      {pending.note && <p className={styles.fine}>Note: {pending.note}</p>}
      {pending.kind === 'edit' && (
        <p className={styles.fine}>
          Contract edit #{pending.editNumber} · demo edit fee {formatCurrency(pending.fee, contract.currency)} (prototype
          only, not charged).
        </p>
      )}
      <div className={styles.noticeActions}>
        {mine ? (
          <>
            <span className={styles.fine}>Waiting for the other party to respond.</span>
            <Button size="sm" variant="secondary" loading={busyKey === 'change-withdraw'} onClick={() => onRespond('withdraw')}>
              Withdraw
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" loading={busyKey === 'change-approve'} onClick={() => onRespond('approve')}>
              Approve change
            </Button>
            <Button size="sm" variant="secondary" loading={busyKey === 'change-decline'} onClick={() => onRespond('decline')}>
              Decline
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export function CancellationNotice({ contract, role, onRespond, busyKey }) {
  const request = contract.cancellationRequest
  const mine = request.by === role

  return (
    <div className={styles.notice}>
      <p className={styles.noticeTitle}>Cancellation requested by {sideName(request.by)}</p>
      <p className={styles.fine}>
        Requested {formatAbsoluteDateTime(request.at)}. The contract stays in place until the other party accepts. Any
        early-termination charge is not automatic.
      </p>
      <div className={styles.noticeActions}>
        {mine ? (
          <Button size="sm" variant="secondary" loading={busyKey === 'cancel-withdraw'} onClick={() => onRespond('withdraw')}>
            Withdraw request
          </Button>
        ) : (
          <>
            <Button size="sm" variant="danger" loading={busyKey === 'cancel-accept'} onClick={() => onRespond('accept')}>
              Accept cancellation
            </Button>
            <Button size="sm" variant="secondary" loading={busyKey === 'cancel-decline'} onClick={() => onRespond('decline')}>
              Decline
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export function DisputeNotice({ contract, role, onWithdraw, busyKey }) {
  const { dispute } = contract
  return (
    <div className={styles.notice}>
      <p className={styles.noticeTitle}>Contract disputed by {sideName(dispute.raisedBy)}</p>
      <p>
        <strong>{dispute.reason}</strong>
        {dispute.description && ` — ${dispute.description}`}
      </p>
      <p className={styles.fine}>
        UASK may review the ASK, accepted response, messages and submitted deliverables to support resolution. Payments
        are paused in this demo.
      </p>
      {dispute.raisedBy === role && (
        <div className={styles.noticeActions}>
          <Button size="sm" variant="secondary" loading={busyKey === 'dispute-withdraw'} onClick={onWithdraw}>
            Withdraw dispute
          </Button>
        </div>
      )}
    </div>
  )
}
