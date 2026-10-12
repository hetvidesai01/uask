import Button from '../../components/ui/Button'
import SpringFill from '../../components/ui/SpringFill'
import { PROGRESS_CHECKPOINTS, PROGRESS_LOCK_PERCENT, getStage } from '../../utils/contractMath'
import styles from './ContractParts.module.css'

const REVIEWABLE = { progress: '60% progress milestone', final: 'final work' }

export default function ProgressPanel({ contract, role, busyKey, onUpdateProgress, onSubmit, onReview, onRaiseDispute }) {
  const percent = contract.progressPercent
  const isActive = contract.status === 'active'
  const progressStage = getStage(contract, 'progress')
  const finalStage = getStage(contract, 'final')
  const revisionsLeft = contract.revisionsIncluded - contract.revisionsUsed
  const exhausted = revisionsLeft <= 0

  const nextCheckpoint = PROGRESS_CHECKPOINTS.find((value) => value > percent)
  const pastGate =
    nextCheckpoint > PROGRESS_LOCK_PERCENT && progressStage.status !== 'approved' && progressStage.status !== 'paid'

  const canSubmitProgress =
    percent >= PROGRESS_LOCK_PERCENT && (progressStage.status === 'upcoming' || progressStage.status === 'in_progress')
  const canSubmitFinal =
    percent >= 100 &&
    progressStage.status === 'paid' &&
    (finalStage.status === 'upcoming' || finalStage.status === 'in_progress')

  const submittedKey = [progressStage, finalStage].find((s) => s.status === 'submitted')?.stage

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Project progress</h2>
        <span className={styles.metaText}>{percent}% complete</span>
      </div>

      <div className={styles.progressWrap}>
        <div className={styles.progressBar}>
          <SpringFill className={styles.progressBarFill} value={percent} />
        </div>
        <div className={styles.ticks} aria-hidden="true">
          {PROGRESS_CHECKPOINTS.map((value) => (
            <span
              key={value}
              className={[styles.tick, value <= percent ? styles.tickReached : '', value === 100 ? styles.tickEnd : '', value === 0 ? styles.tickStart : '']
                .filter(Boolean)
                .join(' ')}
              style={{ left: `${value}%` }}
            >
              {value}%
            </span>
          ))}
        </div>
      </div>

      <div className={styles.revisionRow}>
        <span>
          Revisions used: <strong>{contract.revisionsUsed} / {contract.revisionsIncluded}</strong>
        </span>
        {exhausted && (
          <span className={styles.warnText}>
            Included revisions are used up — additional work may require a contract change.
          </span>
        )}
      </div>

      {role === 'provider' && isActive && (
        <div className={styles.controls}>
          {nextCheckpoint != null && !submittedKey && (
            <div className={styles.controlItem}>
              <Button
                size="sm"
                variant="secondary"
                disabled={pastGate}
                loading={busyKey === 'progress-update'}
                onClick={() => onUpdateProgress(nextCheckpoint)}
              >
                Mark progress at {nextCheckpoint}%
              </Button>
              {pastGate && (
                <p className={styles.fine}>The ASK Side must approve the 60% milestone before work continues past it.</p>
              )}
            </div>
          )}
          {canSubmitProgress && (
            <Button loading={busyKey === 'submit-progress'} onClick={() => onSubmit('progress')}>
              Submit 60% milestone
            </Button>
          )}
          {canSubmitFinal && (
            <Button loading={busyKey === 'submit-final'} onClick={() => onSubmit('final')}>
              Submit final work
            </Button>
          )}
          {percent >= 100 && !canSubmitFinal && progressStage.status !== 'paid' && (
            <p className={styles.fine}>Final submission opens after the Progress Payment is marked as paid.</p>
          )}
          {submittedKey && (
            <p className={styles.fine}>
              {REVIEWABLE[submittedKey][0].toUpperCase() + REVIEWABLE[submittedKey].slice(1)} submitted — waiting for the
              ASK Side to review.
            </p>
          )}
        </div>
      )}

      {role === 'seeker' && isActive && submittedKey && (
        <div className={styles.reviewBox}>
          <p className={styles.reviewTitle}>Respond Side submitted the {REVIEWABLE[submittedKey]}</p>
          <p className={styles.fine}>
            Approving makes the {submittedKey === 'progress' ? 'Progress' : 'Final'} Payment due. Nothing is released
            automatically.
          </p>
          <div className={styles.reviewActions}>
            <Button size="sm" loading={busyKey === `approve-${submittedKey}`} onClick={() => onReview(submittedKey, 'approve')}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={exhausted}
              loading={busyKey === `revision-${submittedKey}`}
              onClick={() => onReview(submittedKey, 'revision')}
            >
              Request revision
            </Button>
            <Button size="sm" variant="ghost" onClick={onRaiseDispute}>
              Raise dispute
            </Button>
          </div>
          {exhausted && <p className={styles.warnText}>No included revisions left to request.</p>}
        </div>
      )}

      {role === 'seeker' && isActive && !submittedKey && percent < 100 && (
        <p className={styles.fine}>You will review the 60% milestone and the final work here once they are submitted.</p>
      )}
    </div>
  )
}
