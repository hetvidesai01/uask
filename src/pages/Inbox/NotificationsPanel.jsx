import { useMemo } from 'react'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import NotificationItem from '../../components/notifications/NotificationItem'
import styles from './NotificationsPanel.module.css'

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

export default function NotificationsPanel({
  status,
  notifications,
  unreadCount,
  markingAll,
  onMarkRead,
  onMarkAllRead,
  onRetry,
}) {
  const groups = useMemo(() => groupNotifications(notifications), [notifications])

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
            <Button variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {unreadCount > 0 && (
        <div className={styles.panelHeader}>
          <Button variant="secondary" size="sm" onClick={onMarkAllRead} loading={markingAll}>
            Mark all as read
          </Button>
        </div>
      )}

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
                  <NotificationItem key={notification.id} notification={notification} onMarkRead={onMarkRead} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
