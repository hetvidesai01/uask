import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { getUserById } from '../../services/authService'
import {
  getConnectionsForUser,
  acceptConnectionRequest,
  removeConnection,
} from '../../services/connectionService'
import { getProfileHeadline } from '../../utils/profileHeadline'
import styles from './Connections.module.css'

async function withUsers(entries) {
  const users = await Promise.all(entries.map((entry) => getUserById(entry.userId)))
  return entries
    .map((entry, index) => ({ ...entry, user: users[index] }))
    .filter((entry) => entry.user)
}

function ConnectionRow({ entry, actions, busy }) {
  const { user } = entry
  const rowBusy = busy?.connectionId === entry.connectionId

  return (
    <li className={styles.row}>
      <Link to={`/app/profile/${user.id}`} className={styles.identity}>
        <Avatar src={user.avatarUrl} name={user.name} size="md" />
        <div className={styles.info}>
          <span className={styles.name}>{user.name}</span>
          <span className={styles.headline}>{getProfileHeadline(user)}</span>
        </div>
      </Link>
      <div className={styles.actions}>
        {actions.map((action) => {
          const isThisActionBusy = rowBusy && busy.label === action.label
          return (
            <Button
              key={action.label}
              size="sm"
              variant={action.variant ?? 'secondary'}
              loading={isThisActionBusy}
              disabled={rowBusy && !isThisActionBusy}
              onClick={() => action.onClick(entry, action.label)}
            >
              {action.label}
            </Button>
          )
        })}
      </div>
    </li>
  )
}

export default function Connections() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [status, setStatus] = useState('loading')
  const [connected, setConnected] = useState([])
  const [pendingIncoming, setPendingIncoming] = useState([])
  const [pendingOutgoing, setPendingOutgoing] = useState([])
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const groups = await getConnectionsForUser(user.id)
      const [connectedWithUsers, incomingWithUsers, outgoingWithUsers] = await Promise.all([
        withUsers(groups.connected),
        withUsers(groups.pendingIncoming),
        withUsers(groups.pendingOutgoing),
      ])
      setConnected(connectedWithUsers)
      setPendingIncoming(incomingWithUsers)
      setPendingOutgoing(outgoingWithUsers)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  async function handleAccept(entry, label) {
    setBusy({ connectionId: entry.connectionId, label })
    try {
      await acceptConnectionRequest(entry.connectionId)
      showToast(`You're now connected with ${entry.user.name.split(' ')[0]}.`)
      await load()
    } catch {
      showToast('Something went wrong. Please try again.', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handleDecline(entry, label) {
    setBusy({ connectionId: entry.connectionId, label })
    try {
      await removeConnection(entry.connectionId)
      await load()
    } catch {
      showToast('Something went wrong. Please try again.', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove(entry, label) {
    setBusy({ connectionId: entry.connectionId, label })
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
          Pending requests{pendingIncoming.length > 0 ? ` (${pendingIncoming.length})` : ''}
        </h2>
        {pendingIncoming.length === 0 ? (
          <p className={styles.muted}>No pending requests right now.</p>
        ) : (
          <ul className={styles.list}>
            {pendingIncoming.map((entry) => (
              <ConnectionRow
                key={entry.connectionId}
                entry={entry}
                busy={busy}
                actions={[
                  { label: 'Accept', variant: 'primary', onClick: handleAccept },
                  { label: 'Decline', variant: 'ghost', onClick: handleDecline },
                ]}
              />
            ))}
          </ul>
        )}
      </section>

      {pendingOutgoing.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Sent requests ({pendingOutgoing.length})</h2>
          <ul className={styles.list}>
            {pendingOutgoing.map((entry) => (
              <ConnectionRow
                key={entry.connectionId}
                entry={entry}
                busy={busy}
                actions={[{ label: 'Cancel', variant: 'ghost', onClick: handleDecline }]}
              />
            ))}
          </ul>
        </section>
      )}

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
          <ul className={styles.list}>
            {connected.map((entry) => (
              <ConnectionRow
                key={entry.connectionId}
                entry={entry}
                busy={busy}
                actions={[{ label: 'Remove', variant: 'ghost', onClick: handleRemove }]}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
