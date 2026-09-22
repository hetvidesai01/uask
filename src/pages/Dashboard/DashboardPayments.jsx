import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { getContractsForUser } from '../../services/contractService'
import { getAskById } from '../../services/askService'
import { getUserById } from '../../services/authService'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../utils/formatDate'
import styles from './DashboardPayments.module.css'

// Shared across a contract's own status and each milestone's status —
// 'completed' means the same thing (done, paid, closed out) in both.
const STATUS_BADGE = {
  active: { variant: 'matched', label: 'Active' },
  upcoming: { variant: 'closed', label: 'Upcoming' },
  due: { variant: 'in_review', label: 'Due' },
  paid: { variant: 'open', label: 'Paid' },
  completed: { variant: 'accepted', label: 'Completed' },
}

function StatusPill({ status }) {
  const entry = STATUS_BADGE[status] ?? { variant: 'closed', label: status }
  return <Badge variant={entry.variant}>{entry.label}</Badge>
}

function isSettled(milestoneStatus) {
  return milestoneStatus === 'paid' || milestoneStatus === 'completed'
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

  const totalPaid = contracts.reduce(
    (sum, contract) =>
      sum + contract.milestones.filter((m) => isSettled(m.status)).reduce((s, m) => s + m.amount, 0),
    0
  )
  const milestonesDue = contracts.reduce(
    (count, contract) => count + contract.milestones.filter((m) => m.status === 'due').length,
    0
  )

  const roles = user.roles ?? []
  const isProviderOnly = roles.includes('provider') && !roles.includes('seeker')
  const isSeekerOnly = roles.includes('seeker') && !roles.includes('provider')
  const emptyMessage = isProviderOnly
    ? 'Once one of your offers is accepted, the project and its milestones will show up here.'
    : isSeekerOnly
      ? 'Once you accept an offer, the project and its payment milestones will show up here.'
      : 'Once an offer is accepted — as a seeker or a provider — the project will show up here.'

  return (
    <div className={styles.payments}>
      <div className={styles.header}>
        <h1 className={styles.title}>Payments &amp; Milestones</h1>
        <p className={styles.subtitle}>Track accepted projects and where each one stands on payment.</p>
      </div>

      {contracts.length === 0 ? (
        <EmptyState icon="💳" title="No active projects yet" message={emptyMessage} />
      ) : (
        <>
          <div className={styles.stats}>
            <StatCard label="Active projects" value={contracts.length} />
            <StatCard label="Paid to date" value={formatCurrency(totalPaid, 'USD')} />
            <StatCard label="Milestones due" value={milestonesDue} />
          </div>

          <div className={styles.grid}>
            {contracts.map((contract) => {
              const ask = asksById[contract.askId]
              const otherUserId = contract.seekerId === user.id ? contract.providerId : contract.seekerId
              return (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  ask={ask}
                  currentUserId={user.id}
                  otherUser={usersById[otherUserId]}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
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
        <StatusPill status={contract.status} />
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
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
        <span className={styles.progressLabel}>
          {paidCount} of {totalCount} milestones paid
        </span>
      </div>

      {nextMilestone ? (
        <div className={styles.nextMilestone}>
          <div className={styles.nextMilestoneText}>
            <p className={styles.nextMilestoneTitle}>{nextMilestone.title}</p>
            <p className={styles.nextMilestoneDue}>Due {formatAbsoluteDate(nextMilestone.dueDate)}</p>
          </div>
          <div className={styles.nextMilestoneRight}>
            <span className={styles.nextMilestoneAmount}>
              {formatCurrency(nextMilestone.amount, contract.currency)}
            </span>
            <StatusPill status={nextMilestone.status} />
          </div>
        </div>
      ) : (
        <p className={styles.allSettled}>All milestones paid</p>
      )}
    </Card>
  )
}
