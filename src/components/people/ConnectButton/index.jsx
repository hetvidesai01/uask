import { useCallback, useEffect, useState } from 'react'
import Button from '../../ui/Button'
import { getConnectionStatus, connectWithUser, removeConnection } from '../../../services/connectionService'
import styles from './ConnectButton.module.css'

// Connect -> Connected happens immediately on click — UASK's connection
// model has no request/approval step (see services/connectionService.js).
// `showRemove` opts in to an inline "Remove connection" action for
// contexts (Profile, Connections page) where that makes sense; compact
// contexts (search results, Discover People cards) leave it off.
export default function ConnectButton({ currentUserId, targetUserId, size = 'sm', showRemove = false, onChange }) {
  const [status, setStatus] = useState('loading')
  const [connectionId, setConnectionId] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const result = await getConnectionStatus(currentUserId, targetUserId)
    setStatus(result.status)
    setConnectionId(result.connectionId)
  }, [currentUserId, targetUserId])

  useEffect(() => {
    let cancelled = false
    getConnectionStatus(currentUserId, targetUserId).then((result) => {
      if (cancelled) return
      setStatus(result.status)
      setConnectionId(result.connectionId)
    })
    return () => {
      cancelled = true
    }
    // `refresh` is a stable wrapper around the same call with the same
    // deps — re-running this effect off it would be redundant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, targetUserId])

  async function runAction(action) {
    setBusy(true)
    try {
      await action()
      await refresh()
      onChange?.()
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading' || status === 'self') return null

  if (status === 'connected') {
    return (
      <div className={styles.wrap}>
        <Button size={size} variant="secondary" disabled>
          Connected
        </Button>
        {showRemove && (
          <button
            type="button"
            className={styles.removeLink}
            disabled={busy}
            onClick={() => runAction(() => removeConnection(connectionId))}
          >
            Remove connection
          </button>
        )}
      </div>
    )
  }

  return (
    <Button size={size} loading={busy} onClick={() => runAction(() => connectWithUser(currentUserId, targetUserId))}>
      Connect
    </Button>
  )
}
