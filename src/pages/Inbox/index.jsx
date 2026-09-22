import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useMatch, useNavigate, useSearchParams } from 'react-router-dom'
import ThreadList from '../../components/messages/ThreadList'
import Tabs from '../../components/ui/Tabs'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import NotificationsPanel from './NotificationsPanel'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { getThreads } from '../../services/messageService'
import { getUserById } from '../../services/authService'
import { getAskById } from '../../services/askService'
import { getNotifications, markAllAsRead, markAsRead } from '../../services/notificationService'
import styles from './Inbox.module.css'

const TAB_ITEMS = [
  { id: 'messages', label: 'Messages' },
  { id: 'notifications', label: 'Notifications' },
]

export default function Inbox() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const match = useMatch('/app/inbox/messages/:threadId')
  const activeThreadId = match?.params?.threadId

  // A thread being open always means the Messages tab, regardless of `?tab=`.
  const activeTab = activeThreadId
    ? 'messages'
    : searchParams.get('tab') === 'notifications'
      ? 'notifications'
      : 'messages'

  // Messages tab state — ported from the old Messages page.
  const [messagesStatus, setMessagesStatus] = useState('loading')
  const [threads, setThreads] = useState([])
  const [participantsById, setParticipantsById] = useState({})
  const [askTitlesById, setAskTitlesById] = useState({})

  // Notifications tab state — ported from the old Notifications page.
  const [notificationsStatus, setNotificationsStatus] = useState('loading')
  const [notifications, setNotifications] = useState([])
  const [markingAll, setMarkingAll] = useState(false)

  const loadMessages = useCallback(async () => {
    if (!user) return
    setMessagesStatus('loading')
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
      setMessagesStatus('done')
    } catch {
      setMessagesStatus('error')
    }
  }, [user])

  const loadNotifications = useCallback(async () => {
    if (!user) return
    setNotificationsStatus('loading')
    try {
      const result = await getNotifications(user.id)
      setNotifications(result)
      setNotificationsStatus('done')
    } catch {
      setNotificationsStatus('error')
    }
  }, [user])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

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

  const notificationsUnreadCount = notifications.filter((notification) => !notification.read).length

  async function handleMarkRead(id) {
    setNotifications((current) =>
      current.map((notification) => (notification.id === id ? { ...notification, read: true } : notification))
    )
    try {
      await markAsRead(id)
    } catch {
      setNotifications((current) =>
        current.map((notification) => (notification.id === id ? { ...notification, read: false } : notification))
      )
      showToast('Something went wrong. Please try again.', 'error')
    }
  }

  async function handleMarkAllRead() {
    const previous = notifications
    setMarkingAll(true)
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })))
    try {
      await markAllAsRead(user.id)
    } catch {
      setNotifications(previous)
      showToast('Something went wrong marking notifications as read.', 'error')
    } finally {
      setMarkingAll(false)
    }
  }

  function handleTabChange(tabId) {
    navigate(tabId === 'notifications' ? '/app/inbox?tab=notifications' : '/app/inbox')
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Inbox</h1>

      <Tabs items={TAB_ITEMS} active={activeTab} onChange={handleTabChange} />

      {activeTab === 'messages' ? (
        <MessagesTabPanel
          status={messagesStatus}
          threads={threads}
          participantsById={participantsById}
          askTitlesById={askTitlesById}
          currentUserId={user.id}
          activeThreadId={activeThreadId}
          onRetry={loadMessages}
          outletContext={{
            threads,
            participantsById,
            askTitlesById,
            currentUser: user,
            onThreadRead: markThreadReadLocally,
            onMessageSent: touchThreadLocally,
          }}
        />
      ) : (
        <NotificationsPanel
          status={notificationsStatus}
          notifications={notifications}
          unreadCount={notificationsUnreadCount}
          markingAll={markingAll}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onRetry={loadNotifications}
        />
      )}
    </div>
  )
}

function MessagesTabPanel({
  status,
  threads,
  participantsById,
  askTitlesById,
  currentUserId,
  activeThreadId,
  onRetry,
  outletContext,
}) {
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
            <Button variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  if (threads.length === 0) {
    return (
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
    )
  }

  return (
    <div className={styles.layout} data-has-thread={Boolean(activeThreadId)}>
      <div className={styles.listPane}>
        <ThreadList
          threads={threads}
          participantsById={participantsById}
          askTitlesById={askTitlesById}
          currentUserId={currentUserId}
          activeThreadId={activeThreadId}
        />
      </div>

      <div className={styles.detailPane}>
        {activeThreadId ? (
          <Outlet context={outletContext} />
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
  )
}
