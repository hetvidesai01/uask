import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import NotificationItem from '../../components/notifications/NotificationItem'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { getNotifications, markAllAsRead, markAsRead } from '../../services/notificationService'
import styles from './Notifications.module.css'

const GROUP_ORDER = ['Today', 'This week', 'Earlier']

function getBucket(isoDate) {
  const date = new Date(isoDate)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.round((startOfToday - startOfDate) / 86400000)

  if (dayDiff <= 0) return 'Today'
  if (dayDiff <= 7) return 'This week'
  return 'Earlier'
}

function groupNotifications(items) {
  const groups = { Today: [], 'This week': [], Earlier: [] }
  items.forEach((item) => {
    groups[getBucket(item.createdAt)].push(item)
  })
  return GROUP_ORDER.map((label) => [label, groups[label]]).filter(([, list]) => list.length > 0)
}

export default function Notifications() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [status, setStatus] = useState('loading')
  const [notifications, setNotifications] = useState([])
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setStatus('loading')
    try {
      const result = await getNotifications(user.id)
      setNotifications(result)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const unreadCount = notifications.filter((notification) => !notification.read).length
  const groups = useMemo(() => groupNotifications(notifications), [notifications])

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
          title="Couldn't load your notifications"
          message="Something went wrong loading your notifications. Please try again."
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
        <h1 className={styles.title}>Notifications</h1>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead} loading={markingAll}>
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className={styles.centered}>
          <EmptyState
            icon="🔔"
            title="You're all caught up"
            message="New offers, messages, and ASK updates will show up here."
          />
        </div>
      ) : (
        <div className={styles.groups}>
          {groups.map(([label, items]) => (
            <section key={label} className={styles.group}>
              <h2 className={styles.groupTitle}>{label}</h2>
              <ul className={styles.list}>
                {items.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} onMarkRead={handleMarkRead} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
