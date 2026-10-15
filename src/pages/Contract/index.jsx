import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Reveal, RevealGroup } from '../../components/ui/Reveal'
import { SOFT_SPRING } from '../../utils/motion'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import ContractStatusBadge from '../../components/contract/ContractStatusBadge'
import RatingForm from './RatingForm'
import ContractJourney from './ContractJourney'
import SigningPanel from './SigningPanel'
import PaymentSchedule from './PaymentSchedule'
import ProgressPanel from './ProgressPanel'
import ContractDetails from './ContractDetails'
import ContractHistory from './ContractHistory'
import CompletionPanel from './CompletionPanel'
import TermsDrawer from './TermsDrawer'
import { PendingChangeCard, CancellationNotice, DisputeNotice } from './ContractNotices'
import { ProposeChangeModal, CancellationModal, DisputeModal, InvoiceModal } from './ContractModals'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { getAskById } from '../../services/askService'
import { getUserById } from '../../services/authService'
import {
  getContractByAskId,
  markStagePaid,
  raiseDispute,
  rateContract,
  requestCancellation,
  respondToCancellation,
  respondToChange,
  reviewStage,
  proposeContractChange,
  signContract,
  submitStage,
  updateProgress,
  withdrawDispute,
} from '../../services/contractService'
import { getChangeKind, isTermsLocked } from '../../utils/contractMath'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../utils/formatDate'
import styles from './Contract.module.css'

const CHANGE_BUTTON_LABEL = {
  edit: 'Edit contract',
  amendment: 'Propose amendment',
  dispute_correction: 'Propose correction',
}

export default function Contract() {
  const { askId } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [status, setStatus] = useState('loading')
  const [contract, setContract] = useState(null)
  const [ask, setAsk] = useState(null)
  const [seeker, setSeeker] = useState(null)
  const [provider, setProvider] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [modal, setModal] = useState(null) // 'terms' | 'change' | 'cancel' | 'dispute' | 'invoice'
  // Demo-only: lets one tester act as either party. Defaults to the viewer's own side.
  const [viewAs, setViewAs] = useState(null) // 'seeker' | 'provider'

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const foundContract = await getContractByAskId(askId)
      if (!foundContract) {
        setStatus('not_found')
        return
      }
      const [foundAsk, foundSeeker, foundProvider] = await Promise.all([
        getAskById(foundContract.askId),
        getUserById(foundContract.seekerId),
        getUserById(foundContract.providerId),
      ])

      setViewAs((current) => current ?? (user.id === foundContract.providerId ? 'provider' : 'seeker'))
      setContract(foundContract)
      setAsk(foundAsk)
      setSeeker(foundSeeker)
      setProvider(foundProvider)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }, [askId, user.id])

  useEffect(() => {
    load()
  }, [load])

  // Runs a service action, swaps in the returned contract, and reports
  // errors (role/state violations) as toasts.
  async function run(key, action, successMessage, { closeModal = false } = {}) {
    setBusyKey(key)
    try {
      const updated = await action()
      if (updated) {
        setContract(updated)
        if (successMessage) showToast(successMessage)
        if (closeModal) setModal(null)
      }
    } catch (error) {
      showToast(error.message || 'Something went wrong. Please try again.', 'error')
    } finally {
      setBusyKey(null)
    }
  }

  async function handleRatingSubmit({ rating, review }) {
    setRatingSubmitting(true)
    try {
      const updated = await rateContract(contract.id, { rating, review })
      if (updated) {
        setContract(updated)
        showToast('Thanks for rating this project.')
      }
    } catch {
      showToast('Something went wrong submitting your rating. Please try again.', 'error')
    } finally {
      setRatingSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className={styles.centered}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.centered}>
        <EmptyState
          icon="⚠️"
          title="Couldn't load this contract"
          message="We could not load this page. Please try again in a moment."
          action={
            <Button variant="secondary" onClick={load}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  if (status === 'not_found') {
    return (
      <div className={styles.centered}>
        <EmptyState
          icon="🚫"
          title="No contract yet"
          message="This ASK doesn't have an accepted offer yet."
          action={
            <Button as={Link} to={`/app/asks/${askId}`} variant="secondary">
              Back to ASK
            </Button>
          }
        />
      </div>
    )
  }

  const role = viewAs ?? 'seeker'
  const actorId = role === 'seeker' ? contract.seekerId : contract.providerId
  const isParty = user.id === contract.seekerId || user.id === contract.providerId
  const isClosed = contract.status === 'completed' || contract.status === 'cancelled'
  const isPreSign = contract.status === 'draft' || contract.status === 'awaiting_signatures'

  const paidMilestones = contract.milestones.filter((m) => m.status === 'paid')
  const amountPaid = paidMilestones.reduce((sum, m) => sum + m.amount, 0)
  // Mock-only placeholder — not a real ranking/scoring algorithm.
  const boosterPct = Math.round((paidMilestones.length / contract.milestones.length) * 20)

  const changeKind = getChangeKind(contract)
  const locked = isTermsLocked(contract)
  const canChange = !isClosed && !contract.pendingChange
  const canCancel = (isPreSign || contract.status === 'active') && !contract.cancellationRequest
  const canDispute = contract.status === 'active'

  return (
    <RevealGroup calm className={styles.page}>
      <Reveal>
        <Link to={`/app/asks/${askId}`} className={styles.backLink}>
          ← Back to ASK
        </Link>
      </Reveal>

      <Reveal className={styles.header}>
        <span className={styles.kicker}>Contract</span>
        <h1 className={styles.title}>{ask?.title ?? 'Project contract'}</h1>
        <div className={styles.headerBadges}>
          <ContractStatusBadge status={contract.status} />
          <Badge variant="closed">Demo · no real transaction</Badge>
          {isPreSign && <Badge variant="in_review">Draft — not yet active</Badge>}
        </div>
      </Reveal>

      <Reveal className={styles.demoSwitch}>
        <span className={styles.demoSwitchLabel}>
          Demo view — acting as
          {!isParty && ' (you are not a party on this contract)'}
        </span>
        <div className={styles.demoSwitchButtons} role="group" aria-label="Act as">
          {[
            ['seeker', `ASK Side${seeker ? ` · ${seeker.name}` : ''}`],
            ['provider', `Respond Side${provider ? ` · ${provider.name}` : ''}`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={[styles.demoSwitchBtn, role === key ? styles.demoSwitchActive : ''].filter(Boolean).join(' ')}
              aria-pressed={role === key}
              onClick={() => setViewAs(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <ContractJourney contract={contract} />
      </Reveal>

      {contract.status === 'cancelled' && (
        <Reveal>
          <p className={styles.waitingNote}>
            This contract was cancelled by mutual agreement. Completed work may remain payable under the agreed dispute
            process. Nothing was charged in this demo.
          </p>
        </Reveal>
      )}

      {contract.status === 'disputed' && contract.dispute && (
        <Reveal>
          <DisputeNotice
            contract={contract}
            role={role}
            busyKey={busyKey}
            onWithdraw={() => run('dispute-withdraw', () => withdrawDispute(contract.id, actorId), 'Dispute withdrawn.')}
          />
        </Reveal>
      )}

      {contract.cancellationRequest && (
        <Reveal>
          <CancellationNotice
            contract={contract}
            role={role}
            busyKey={busyKey}
            onRespond={(decision) =>
              run(
                `cancel-${decision}`,
                () => respondToCancellation(contract.id, actorId, decision),
                decision === 'accept' ? 'Contract cancelled.' : 'Cancellation request updated.'
              )
            }
          />
        </Reveal>
      )}

      {contract.pendingChange && (
        <Reveal>
          <PendingChangeCard
            contract={contract}
            role={role}
            busyKey={busyKey}
            onRespond={(decision) =>
              run(
                `change-${decision}`,
                () => respondToChange(contract.id, actorId, decision),
                decision === 'approve' ? 'Change approved and applied.' : 'Change updated.'
              )
            }
          />
        </Reveal>
      )}

      <Reveal className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>ASK Side</span>
          <span className={styles.summaryValue}>{seeker?.name ?? '—'}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Respond Side</span>
          <span className={styles.summaryValue}>{provider?.name ?? '—'}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Agreed price</span>
          <span className={styles.summaryValue}>{formatCurrency(contract.agreedPrice, contract.currency)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Marked as paid</span>
          <span className={styles.summaryValue}>
            {formatCurrency(amountPaid, contract.currency)} / {formatCurrency(contract.agreedPrice, contract.currency)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Deadline</span>
          <span className={styles.summaryValue}>{formatAbsoluteDate(contract.deadline)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Revisions used</span>
          <span className={styles.summaryValue}>
            {contract.revisionsUsed} / {contract.revisionsIncluded}
          </span>
        </div>
      </Reveal>

      <Reveal className={styles.actionsRow}>
        <Button size="sm" variant="secondary" onClick={() => setModal('terms')}>
          Terms &amp; Conditions
        </Button>
        {canChange && (
          <Button size="sm" variant="secondary" onClick={() => setModal('change')}>
            {CHANGE_BUTTON_LABEL[changeKind]}
          </Button>
        )}
        {canCancel && (
          <Button size="sm" variant="ghost" onClick={() => setModal('cancel')}>
            Request cancellation
          </Button>
        )}
        {canDispute && (
          <Button size="sm" variant="ghost" onClick={() => setModal('dispute')}>
            Raise dispute
          </Button>
        )}
      </Reveal>

      {locked && !isClosed && changeKind === 'amendment' && (
        <Reveal>
          <p className={styles.waitingNote}>
            Contract terms are locked after the progress milestone. Only a mutually approved amendment or a
            dispute-related correction is possible, through the separate action above.
          </p>
        </Reveal>
      )}

      <Reveal>
        <SigningPanel
          contract={contract}
          role={role}
          seekerName={seeker?.name}
          providerName={provider?.name}
          signing={busyKey === 'sign'}
          onOpenTerms={() => setModal('terms')}
          onSign={() => run('sign', () => signContract(contract.id, actorId), 'You agreed & signed.')}
        />
      </Reveal>

      <Reveal>
        <PaymentSchedule
          contract={contract}
          role={role}
          busyKey={busyKey}
          boosterPct={role === 'provider' ? boosterPct : null}
          onPay={(stageKey) =>
            run(`pay-${stageKey}`, () => markStagePaid(contract.id, actorId, stageKey), 'Marked as paid (demo).')
          }
        />
      </Reveal>

      {!isPreSign && contract.status !== 'cancelled' && (
        <Reveal>
          <ProgressPanel
            contract={contract}
            role={role}
            busyKey={busyKey}
            onUpdateProgress={(percent) =>
              run('progress-update', () => updateProgress(contract.id, actorId, percent), `Progress set to ${percent}%.`)
            }
            onSubmit={(stageKey) =>
              run(`submit-${stageKey}`, () => submitStage(contract.id, actorId, stageKey), 'Submitted for approval.')
            }
            onReview={(stageKey, decision) =>
              run(
                `${decision}-${stageKey}`,
                () => reviewStage(contract.id, actorId, stageKey, decision),
                decision === 'approve' ? 'Approved.' : 'Revision requested.'
              )
            }
            onRaiseDispute={() => setModal('dispute')}
          />
        </Reveal>
      )}

      <Reveal>
        <ContractDetails contract={contract} ask={ask} />
      </Reveal>

      {contract.status === 'completed' && (
        <Reveal>
          <CompletionPanel
            contract={contract}
            seekerName={seeker?.name}
            providerName={provider?.name}
            onOpenInvoice={() => setModal('invoice')}
          />
        </Reveal>
      )}

      {contract.status === 'completed' && contract.rating == null && (
        <Reveal>
          {role === 'seeker' ? (
            <RatingForm onSubmit={handleRatingSubmit} submitting={ratingSubmitting} />
          ) : (
            <p className={styles.waitingNote}>Waiting for the ASK Side to rate this project.</p>
          )}
        </Reveal>
      )}

      {contract.status === 'completed' && contract.rating != null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SOFT_SPRING}
        >
          <Card className={styles.finalRating}>
            <h2 className={styles.sectionTitle}>Final rating</h2>
            <p className={styles.finalRatingValue}>★ {contract.rating.toFixed(1)} / 5</p>
            {contract.review && <p className={styles.finalReview}>&ldquo;{contract.review}&rdquo;</p>}
          </Card>
        </motion.div>
      )}

      <Reveal>
        <ContractHistory history={contract.history} />
      </Reveal>

      <TermsDrawer open={modal === 'terms'} onClose={() => setModal(null)} />
      <ProposeChangeModal
        open={modal === 'change'}
        onClose={() => setModal(null)}
        contract={contract}
        submitting={busyKey === 'change-propose'}
        onSubmit={({ changes, note }) =>
          run(
            'change-propose',
            () => proposeContractChange(contract.id, actorId, { changes, note }),
            'Proposal sent to the other party.',
            { closeModal: true }
          )
        }
      />
      <CancellationModal
        open={modal === 'cancel'}
        onClose={() => setModal(null)}
        contract={contract}
        submitting={busyKey === 'cancel-request'}
        onConfirm={() =>
          run('cancel-request', () => requestCancellation(contract.id, actorId), 'Cancellation request sent.', {
            closeModal: true,
          })
        }
      />
      <DisputeModal
        open={modal === 'dispute'}
        onClose={() => setModal(null)}
        submitting={busyKey === 'dispute-raise'}
        onSubmit={({ reason, description }) =>
          run('dispute-raise', () => raiseDispute(contract.id, actorId, { reason, description }), 'Dispute raised.', {
            closeModal: true,
          })
        }
      />
      <InvoiceModal
        open={modal === 'invoice'}
        onClose={() => setModal(null)}
        contract={contract}
        askTitle={ask?.title}
        seekerName={seeker?.name}
        providerName={provider?.name}
      />
    </RevealGroup>
  )
}
