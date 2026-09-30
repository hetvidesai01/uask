import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Reveal, RevealGroup } from '../../components/ui/Reveal'
import MotionCard from '../../components/ui/MotionCard'
import SpringFill from '../../components/ui/SpringFill'
import AnimatedCounter from '../../components/ui/AnimatedCounter'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import ContractStatusBadge from '../../components/contract/ContractStatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { getContractsForUser } from '../../services/contractService'
import { getAskById } from '../../services/askService'
import { getUserById } from '../../services/authService'
import { formatCurrency, DEFAULT_CURRENCY } from '../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../utils/formatDate'
import styles from './DashboardPayments.module.css'

// 'paid' is the only terminal milestone status — see mocks/contracts.js
// for the full upcoming -> in_progress -> submitted -> approved -> paid flow.
// Profile Booster tops out at +20% (see the formula in this file).
const BOOSTER_MAX_PCT = 20

function isSettled(milestoneStatus) {
  return milestoneStatus === 'paid'
}

export default function DashboardPayments() {
  const { user } = useAuth()

  const [status, setStatus] = useState('loading')
  const [contracts, setContracts] = useState([])
  const [asksById, setAsksById] = useState({})
  const [usersById, setUsersById] = useState({})

  const load = useCallback(async () => {
    if (!user) return
    setStatus('loading')
    try {
      const myContracts = await getContractsForUser(user.id)

      const askIds = [...new Set(myContracts.map((contract) => contract.askId))]
      const otherUserIds = [
        ...new Set(
          myContracts.map((contract) => (contract.seekerId === user.id ? contract.providerId : contract.seekerId))
        ),
      ]

      const [asks, otherUsers] = await Promise.all([
        Promise.all(askIds.map((id) => getAskById(id))),
        Promise.all(otherUserIds.map((id) => getUserById(id))),
      ])

      setContracts(myContracts)
      setAsksById(Object.fromEntries(asks.filter(Boolean).map((ask) => [ask.id, ask])))
      setUsersById(Object.fromEntries(otherUsers.filter(Boolean).map((item) => [item.id, item])))
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

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
          title="Couldn't load your projects"
          message="Something went wrong loading your payments and milestones. Please try again."
          action={
            <Button variant="secondary" onClick={load}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  // The top metrics describe performance as a provider — revenue and
  // ratings are earned/received for work done, not money paid out or
  // ratings given as a seeker — so they're scoped to contracts where the
  // current user is the provider.
  const providerContracts = contracts.filter(
    (contract) => contract.providerId === user.id && (contract.status === 'active' || contract.status === 'completed')
  )

  const revenue = providerContracts.reduce(
    (sum, contract) =>
      sum + contract.milestones.filter((m) => isSettled(m.status)).reduce((s, m) => s + m.amount, 0),
    0
  )

  const ratedCompletedContracts = providerContracts.filter(
    (contract) => contract.status === 'completed' && contract.rating != null
  )
  const averageRating = ratedCompletedContracts.length
    ? ratedCompletedContracts.reduce((sum, contract) => sum + contract.rating, 0) / ratedCompletedContracts.length
    : null

  const completedMilestoneCount = providerContracts.reduce(
    (count, contract) => count + contract.milestones.filter((m) => m.status === 'paid').length,
    0
  )
  const totalMilestoneCount = providerContracts.reduce(
    (count, contract) => count + contract.milestones.length,
    0
  )
  const milestoneCompletionPct = totalMilestoneCount
    ? Math.round((completedMilestoneCount / totalMilestoneCount) * 100)
    : 0
  // Mock-only placeholder — not a real ranking/scoring algorithm. Scales
  // milestone completion down to a modest "boost" rather than a 1:1 percentage.
  const profileBoosterPct = totalMilestoneCount
    ? Math.round((completedMilestoneCount / totalMilestoneCount) * 20)
    : 0

  const roles = user.roles ?? []
  const isProviderOnly = roles.includes('provider') && !roles.includes('seeker')
  const isSeekerOnly = roles.includes('seeker') && !roles.includes('provider')
  const emptyMessage = isProviderOnly
    ? 'Once one of your offers is accepted, the project and its milestones will show up here.'
    : isSeekerOnly
      ? 'Once you accept an offer, the project and its payment milestones will show up here.'
      : 'Once an offer is accepted — as a seeker or a provider — the project will show up here.'

  return (
    <RevealGroup className={styles.payments}>
      <Reveal className={styles.header}>
        <h1 className={styles.title}>Payments &amp; Milestones</h1>
        <p className={styles.subtitle}>Track accepted projects and where each one stands on payment.</p>
      </Reveal>

      {/* Always visible, even with zero contracts — derived from filtered
          (possibly empty) data, never hidden behind the empty state. */}
      <RevealGroup className={styles.stats}>
        <StatCard
          label="Revenue"
          value={<AnimatedCounter value={revenue} duration={1} format={(n) => formatCurrency(n, DEFAULT_CURRENCY)} />}
        />
        <StatCard
          label="Average rating"
          value={
            averageRating != null ? (
              <AnimatedCounter
                value={Math.round(averageRating * 10)}
                duration={0.9}
                format={(n) => `${(n / 10).toFixed(1)} / 5`}
              />
            ) : (
              '— / 5'
            )
          }
        />

        <Reveal className={styles.milestonesCard}>
          <span className={styles.milestonesLabel}>Milestones</span>
          <span className={styles.milestonesValue}>
            <AnimatedCounter value={completedMilestoneCount} /> / <AnimatedCounter value={totalMilestoneCount} /> completed
          </span>
          <div className={styles.progressTrack}>
            <SpringFill className={styles.progressFill} value={milestoneCompletionPct} delay={0.15} />
          </div>
          <div className={styles.progressTrack}>
            <SpringFill
              className={styles.progressFill}
              value={(profileBoosterPct / BOOSTER_MAX_PCT) * 100}
              delay={0.3}
            />
          </div>
          {/* key remounts the label when the value changes so it pulses once. */}
          <motion.span
            key={profileBoosterPct}
            className={styles.boosterLabel}
            initial={{ scale: 1.14 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14 }}
            style={{ display: 'inline-block', transformOrigin: 'left center' }}
          >
            Profile Booster +{profileBoosterPct}%
          </motion.span>
        </Reveal>
      </RevealGroup>

      {contracts.length === 0 ? (
        <EmptyState icon="💳" title="No active projects yet" message={emptyMessage} />
      ) : (
        <RevealGroup className={styles.grid}>
          {contracts.map((contract) => {
            const ask = asksById[contract.askId]
            const otherUserId = contract.seekerId === user.id ? contract.providerId : contract.seekerId
            return (
              <Reveal key={contract.id}>
                <MotionCard lift={3}>
                  <ContractCard
                    contract={contract}
                    ask={ask}
                    currentUserId={user.id}
                    otherUser={usersById[otherUserId]}
                  />
                </MotionCard>
              </Reveal>
            )
          })}
        </RevealGroup>
      )}
    </RevealGroup>
  )
}

function ContractCard({ contract, ask, currentUserId, otherUser }) {
  const otherRoleLabel = contract.seekerId === currentUserId ? 'Provider' : 'Seeker'

  const paidCount = contract.milestones.filter((m) => isSettled(m.status)).length
  const totalCount = contract.milestones.length
  const progressPct = totalCount ? Math.round((paidCount / totalCount) * 100) : 0

  const nextMilestone = [...contract.milestones]
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .find((m) => !isSettled(m.status))

  return (
    <Card padding="lg" className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderText}>
          <p className={styles.askEyebrow}>{ask?.category ?? 'Project'}</p>
          <Link to={`/app/asks/${contract.askId}`} className={styles.askTitle}>
            {ask?.title ?? 'View ASK'}
          </Link>
        </div>
        <ContractStatusBadge status={contract.status} />
      </div>

      <p className={styles.withParty}>
        With <strong>{otherUser?.name ?? 'Unknown'}</strong> &middot; {otherRoleLabel}
      </p>

      <div className={styles.amountRow}>
        <span className={styles.amountLabel}>Total agreed</span>
        <span className={styles.amount}>{formatCurrency(contract.agreedPrice, contract.currency)}</span>
      </div>

      <div className={styles.progressBlock}>
        <div className={styles.progressTrack}>
          <SpringFill className={styles.progressFill} value={progressPct} delay={0.2} />
        </div>
        <span className={styles.progressLabel}>
          {paidCount} of {totalCount} milestones paid
        </span>
      </div>

      {nextMilestone ? (
        <motion.div
          key={nextMilestone.id}
          className={styles.nextMilestone}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className={styles.nextMilestoneText}>
            <p className={styles.nextMilestoneTitle}>{nextMilestone.title}</p>
            <p className={styles.nextMilestoneDue}>Due {formatAbsoluteDate(nextMilestone.dueDate)}</p>
          </div>
          <div className={styles.nextMilestoneRight}>
            <span className={styles.nextMilestoneAmount}>
              {formatCurrency(nextMilestone.amount, contract.currency)}
            </span>
            <ContractStatusBadge status={nextMilestone.status} />
          </div>
        </motion.div>
      ) : (
        <p className={styles.allSettled}>All milestones paid</p>
      )}

      {contract.status === 'completed' && contract.rating != null && (
        <div className={styles.ratingRow}>
          <span className={styles.ratingLabel}>Final rating</span>
          <span className={styles.ratingValue}>★ {contract.rating.toFixed(1)} / 5</span>
        </div>
      )}

      <Link to={`/app/asks/${contract.askId}/contract`} className={styles.viewContractLink}>
        View Contract →
      </Link>
    </Card>
  )
}
