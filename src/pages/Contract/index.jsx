import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Tag from '../../components/ui/Tag'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import ContractStatusBadge from '../../components/contract/ContractStatusBadge'
import MilestoneTimeline from './MilestoneTimeline'
import RatingForm from './RatingForm'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { getAskById } from '../../services/askService'
import { getOffersByIds } from '../../services/offerService'
import { getUserById } from '../../services/authService'
import {
  getContractByAskId,
  markContractCompleted,
  rateContract,
  updateMilestoneStatus,
} from '../../services/contractService'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../utils/formatDate'
import styles from './Contract.module.css'

export default function Contract() {
  const { askId } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [status, setStatus] = useState('loading')
  const [contract, setContract] = useState(null)
  const [ask, setAsk] = useState(null)
  const [seeker, setSeeker] = useState(null)
  const [provider, setProvider] = useState(null)
  const [offer, setOffer] = useState(null)
  const [actioningMilestoneId, setActioningMilestoneId] = useState(null)
  const [completing, setCompleting] = useState(false)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const foundContract = await getContractByAskId(askId)
      if (!foundContract) {
        setStatus('not_found')
        return
      }
      if (user.id !== foundContract.seekerId && user.id !== foundContract.providerId) {
        setStatus('unauthorized')
        return
      }

      const [foundAsk, foundSeeker, foundProvider, offers] = await Promise.all([
        getAskById(foundContract.askId),
        getUserById(foundContract.seekerId),
        getUserById(foundContract.providerId),
        getOffersByIds([foundContract.offerId]),
      ])

      setContract(foundContract)
      setAsk(foundAsk)
      setSeeker(foundSeeker)
      setProvider(foundProvider)
      setOffer(offers[0] ?? null)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }, [askId, user.id])

  useEffect(() => {
    load()
  }, [load])

  async function handleMilestoneAction(milestoneId, nextStatus) {
    setActioningMilestoneId(milestoneId)
    try {
      const updated = await updateMilestoneStatus(contract.id, milestoneId, nextStatus)
      if (updated) {
        setContract(updated)
        showToast('Milestone updated.')
      }
    } catch {
      showToast('Something went wrong updating this milestone. Please try again.', 'error')
    } finally {
      setActioningMilestoneId(null)
    }
  }

  async function handleMarkCompleted() {
    setCompleting(true)
    try {
      const updated = await markContractCompleted(contract.id)
      if (updated) {
        setContract(updated)
        showToast('Project marked as completed.')
      }
    } catch {
      showToast('Something went wrong. Please try again.', 'error')
    } finally {
      setCompleting(false)
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
          message="Something went wrong loading this page. Please try again."
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

  if (status === 'unauthorized') {
    return (
      <div className={styles.centered}>
        <EmptyState
          icon="🔒"
          title="You don't have access to this contract"
          message="Only the client and provider on this project can view its contract."
          action={
            <Button as={Link} to={`/app/asks/${askId}`} variant="secondary">
              Back to ASK
            </Button>
          }
        />
      </div>
    )
  }

  const isOwner = user.id === contract.seekerId
  const isProvider = user.id === contract.providerId

  const paidCount = contract.milestones.filter((m) => m.status === 'paid').length
  const totalCount = contract.milestones.length
  const completionPct = totalCount ? Math.round((paidCount / totalCount) * 100) : 0
  // Mock-only placeholder — not a real ranking/scoring algorithm.
  const boosterPct = totalCount ? Math.round((paidCount / totalCount) * 20) : 0
  const allPaid = totalCount > 0 && paidCount === totalCount

  const amountPaid = contract.milestones
    .filter((m) => m.status === 'paid')
    .reduce((sum, m) => sum + m.amount, 0)
  const remaining = contract.agreedPrice - amountPaid
  const paymentStatus =
    amountPaid === 0
      ? { variant: 'closed', label: 'Not started' }
      : amountPaid < contract.agreedPrice
        ? { variant: 'in_review', label: 'In progress' }
        : { variant: 'open', label: 'Fully paid' }

  const expectedCompletion = contract.milestones.reduce((latest, m) => {
    const due = new Date(m.dueDate)
    return !latest || due > latest ? due : latest
  }, null)

  return (
    <div className={styles.page}>
      <Link to={`/app/asks/${askId}`} className={styles.backLink}>
        ← Back to ASK
      </Link>

      <div className={styles.header}>
        <span className={styles.kicker}>Contract</span>
        <h1 className={styles.title}>{ask?.title ?? 'Project contract'}</h1>
        <div className={styles.headerBadges}>
          <ContractStatusBadge status={contract.status} />
          <Badge variant={paymentStatus.variant}>{paymentStatus.label}</Badge>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Client</span>
          <span className={styles.summaryValue}>{seeker?.name ?? '—'}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Provider</span>
          <span className={styles.summaryValue}>{provider?.name ?? '—'}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Accepted offer</span>
          <span className={styles.summaryValue}>
            {offer ? `${formatCurrency(offer.price, offer.currency)} · ${offer.deliveryDays}-day delivery` : '—'}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Agreed amount</span>
          <span className={styles.summaryValue}>{formatCurrency(contract.agreedPrice, contract.currency)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Start date</span>
          <span className={styles.summaryValue}>{formatAbsoluteDate(contract.createdAt)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Expected completion</span>
          <span className={styles.summaryValue}>
            {expectedCompletion ? formatAbsoluteDate(expectedCompletion) : '—'}
          </span>
        </div>
      </div>

      {contract.deliverables.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Deliverables</h2>
          <div className={styles.deliverablesList}>
            {contract.deliverables.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </div>
        </div>
      )}

      <div className={styles.paymentSummary}>
        <div className={styles.paymentRow}>
          <span>Total contract value</span>
          <strong>{formatCurrency(contract.agreedPrice, contract.currency)}</strong>
        </div>
        <div className={styles.paymentRow}>
          <span>Amount paid</span>
          <strong>{formatCurrency(amountPaid, contract.currency)}</strong>
        </div>
        <div className={styles.paymentRow}>
          <span>Remaining</span>
          <strong>{formatCurrency(remaining, contract.currency)}</strong>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.milestonesHeader}>
          <h2 className={styles.sectionTitle}>Milestones</h2>
          <span className={styles.milestonesCount}>
            {paidCount} / {totalCount} completed
          </span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${completionPct}%` }} />
        </div>
        <p className={styles.boosterLabel}>Profile Booster +{boosterPct}%</p>

        <MilestoneTimeline
          milestones={contract.milestones}
          currency={contract.currency}
          isOwner={isOwner}
          isProvider={isProvider}
          onAction={handleMilestoneAction}
          actioningId={actioningMilestoneId}
        />
      </div>

      {allPaid && contract.status !== 'completed' && (
        isOwner ? (
          <Card className={styles.completeCta}>
            <div>
              <h2 className={styles.sectionTitle}>All milestones are paid</h2>
              <p className={styles.ctaText}>Mark this project as completed to close it out.</p>
            </div>
            <Button onClick={handleMarkCompleted} loading={completing}>
              Mark project as completed
            </Button>
          </Card>
        ) : (
          <p className={styles.waitingNote}>
            All milestones are paid — waiting for the client to mark this project complete.
          </p>
        )
      )}

      {contract.status === 'completed' && contract.rating == null && (
        isOwner ? (
          <RatingForm onSubmit={handleRatingSubmit} submitting={ratingSubmitting} />
        ) : (
          <p className={styles.waitingNote}>Waiting for the client to rate this project.</p>
        )
      )}

      {contract.status === 'completed' && contract.rating != null && (
        <Card className={styles.finalRating}>
          <h2 className={styles.sectionTitle}>Final rating</h2>
          <p className={styles.finalRatingValue}>★ {contract.rating.toFixed(1)} / 5</p>
          {contract.review && <p className={styles.finalReview}>&ldquo;{contract.review}&rdquo;</p>}
        </Card>
      )}
    </div>
  )
}
