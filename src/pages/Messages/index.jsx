import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useMatch } from 'react-router-dom'
import ThreadList from '../../components/messages/ThreadList'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { getThreads } from '../../services/messageService'
import { getUserById } from '../../services/authService'
import { getAskById } from '../../services/askService'
import styles from './Messages.module.css'

export default function Messages() {
  const { user } = useAuth()
  const match = useMatch('/app/messages/:threadId')
  const activeThreadId = match?.params?.threadId

  const [status, setStatus] = useState('loading')
  const [threads, setThreads] = useState([])
  const [participantsById, setParticipantsById] = useState({})
  const [askTitlesById, setAskTitlesById] = useState({})

  const load = useCallback(async () => {
    if (!user) return
    setStatus('loading')
    try {
      const myThreads = await getThreads(user.id)

      const participantIds = [...new Set(myThreads.flatMap((thread) => thread.participantIds))]
      const askIds = [...new Set(myThreads.map((thread) => thread.askId).filter(Boolean))]

      const [participants, asks] = await Promise.all([
        Promise.all(participantIds.map((id) => getUserById(id))),
        Promise.all(askIds.map((id) => getAskById(id))),
      ])

      setThreads(myThreads)
      setParticipantsById(Object.fromEntries(participants.filter(Boolean).map((p) => [p.id, p])))
      setAskTitlesById(Object.fromEntries(asks.filter(Boolean).map((a) => [a.id, a])))
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const markThreadReadLocally = useCallback((threadId) => {
    setThreads((current) =>
      current.map((thread) => (thread.id === threadId ? { ...thread, unreadCount: 0 } : thread))
    )
  }, [])

  const touchThreadLocally = useCallback((threadId, lastMessage) => {
    setThreads((current) =>
      current
        .map((thread) =>
          thread.id === threadId
            ? { ...thread, lastMessage, updatedAt: new Date().toISOString() }
            : thread
        )
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    )
  }, [])

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
          title="Couldn't load your messages"
          message="Something went wrong loading your conversations. Please try again."
          action={
            <Button variant="secondary" onClick={load}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Messages</h1>
        <div className={styles.centered}>
          <EmptyState
            icon="💬"
            title="No conversations yet"
            message="Once you connect with a seeker or provider, your conversations will show up here."
            action={
              <Button as={Link} to="/app/discover" variant="secondary">
                Discover ASKs
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Messages</h1>

      <div className={styles.layout} data-has-thread={Boolean(activeThreadId)}>
        <div className={styles.listPane}>
          <ThreadList
            threads={threads}
            participantsById={participantsById}
            askTitlesById={askTitlesById}
            currentUserId={user.id}
            activeThreadId={activeThreadId}
          />
        </div>

        <div className={styles.detailPane}>
          {activeThreadId ? (
            <Outlet
              context={{
                threads,
                participantsById,
                askTitlesById,
                currentUser: user,
                onThreadRead: markThreadReadLocally,
                onMessageSent: touchThreadLocally,
              }}
            />
          ) : (
            <div className={styles.noSelection}>
              <EmptyState
                icon="💬"
                title="Select a conversation"
                message="Choose a thread from the list to see the full conversation."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
