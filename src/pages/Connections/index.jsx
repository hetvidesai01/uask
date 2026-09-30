import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { revealGroup, revealItem, SNAPPY_SPRING } from '../../utils/motion'
import MessageUserButton from '../../components/people/MessageUserButton'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { getUserById } from '../../services/authService'
import { getConnectionsForUser, removeConnection } from '../../services/connectionService'
import { getProfileHeadline } from '../../utils/profileHeadline'
import styles from './Connections.module.css'

async function withUsers(entries) {
  const users = await Promise.all(entries.map((entry) => getUserById(entry.userId)))
  return entries
    .map((entry, index) => ({ ...entry, user: users[index] }))
    .filter((entry) => entry.user)
}

function ConnectionRow({ entry, busy, onRemove, currentUserId }) {
  const { user } = entry
  const rowBusy = busy === entry.connectionId

  return (
    <motion.li className={styles.row} variants={revealItem} whileHover={{ y: -2 }} transition={SNAPPY_SPRING}>
      <Link to={`/app/profile/${user.id}`} className={styles.identity}>
        <Avatar src={user.avatarUrl} name={user.name} size="md" />
        <div className={styles.info}>
          <span className={styles.name}>{user.name}</span>
          <span className={styles.headline}>{getProfileHeadline(user)}</span>
        </div>
      </Link>
      <div className={styles.actions}>
        <MessageUserButton currentUserId={currentUserId} targetUserId={user.id} variant="secondary" />
        <Button size="sm" variant="ghost" loading={rowBusy} disabled={rowBusy} onClick={() => onRemove(entry)}>
          Remove
        </Button>
      </div>
    </motion.li>
  )
}

// UASK connections are immediate (Connect -> Connected) — no request/
// approval step, so this page just shows the current connected list.
export default function Connections() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [status, setStatus] = useState('loading')
  const [connected, setConnected] = useState([])
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const entries = await getConnectionsForUser(user.id)
      setConnected(await withUsers(entries))
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  async function handleRemove(entry) {
    setBusy(entry.connectionId)
    try {
      await removeConnection(entry.connectionId)
      showToast('Connection removed.')
      await load()
    } catch {
      showToast('Something went wrong. Please try again.', 'error')
    } finally {
      setBusy(null)
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
          title="Couldn't load connections"
          message="Something went wrong loading your connections. Please try again."
          action={
            <Button variant="secondary" onClick={load}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Connections</h1>
        <p className={styles.subtitle}>A simple professional network — not a feed.</p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Connected{connected.length > 0 ? ` (${connected.length})` : ''}
        </h2>
        {connected.length === 0 ? (
          <EmptyState
            icon="🤝"
            title="No connections yet"
            message="Connect with people you meet through ASKs and offers to build your professional network here."
          />
        ) : (
          <motion.ul className={styles.list} initial="hidden" animate="visible" variants={revealGroup}>
            {connected.map((entry) => (
              <ConnectionRow
                key={entry.connectionId}
                entry={entry}
                busy={busy}
                onRemove={handleRemove}
                currentUserId={user.id}
              />
            ))}
          </motion.ul>
        )}
      </section>
    </div>
  )
}
