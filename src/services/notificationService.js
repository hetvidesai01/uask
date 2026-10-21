import { http } from './http'

// Notifications are fully backend-owned:
//   GET   /notifications               → envelope (unreadOnly/page/pageSize)
//   PATCH /notifications/{id}/read     → 200, the updated notification
//   PATCH /notifications/read-all      → 204 no content
//
// The old mock used local POST/list-style mutations; the PATCH/204
// difference is absorbed here so callers keep their existing contracts.
// Types on the wire are the canonical backend set: offer_received,
// offer_shortlisted, offer_accepted, offer_rejected, ask_matched, message
// (+ backend extras ask_closing_soon/system — the UI's icon map falls
// back to a default for unknown types, no mapping layer needed).

// Backend NotificationResponse → the frontend notification model — shapes
// are identical (id, userId, type, title, body, link, read, createdAt);
// only null-safe defaults applied.
function normalizeNotification(notification) {
  if (!notification) return null
  return {
    ...notification,
    body: notification.body ?? null,
    link: notification.link ?? null,
  }
}

// GET /notifications → envelope unwrapped, newest first. `userId` is
// ignored — the backend scopes to the authenticated user; kept in the
// signature for existing callers (Inbox tab, AppLayout badge).
export async function getNotifications(_userId) {
  const page = await http.get('/notifications?pageSize=100')
  return (page?.items ?? [])
    .map(normalizeNotification)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

// PATCH /notifications/{id}/read → the updated notification (same return
// contract the old mock had; callers ignore it today).
export async function markAsRead(id) {
  return normalizeNotification(await http.patch(`/notifications/${id}/read`))
}

// PATCH /notifications/read-all → 204. The old mock returned the updated
// list; no caller uses that return value, so the 204 stays hidden here.
export async function markAllAsRead(_userId) {
  await http.patch('/notifications/read-all')
  return null
}
