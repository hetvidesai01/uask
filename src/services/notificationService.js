import { notifications } from '../mocks/notifications'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getNotifications(userId) {
  await delay()

  return notifications
    .filter((notification) => notification.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function markAsRead(id) {
  await delay()

  const notification = notifications.find((item) => item.id === id)
  if (!notification) return null

  notification.read = true
  return notification
}

export async function markAllAsRead(userId) {
  await delay()

  const userNotifications = notifications.filter((notification) => notification.userId === userId)
  userNotifications.forEach((notification) => {
    notification.read = true
  })

  return userNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}
