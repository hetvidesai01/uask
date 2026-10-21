import { http } from './http'

// Threads + messages are fully backend-owned:
//   GET  /threads                          → inbox listing (envelope)
//   GET  /threads/{id}                     → one thread
//   POST /threads {participantId}          → 201 new / 200 existing (connected pair only)
//   GET  /threads/{id}/messages            → cursor history {items, nextCursor, hasMore}
//   POST /threads/{id}/messages            → 201 sent message
//
// Read behavior is IMPLICIT on the backend: fetching history marks it read
// (server-side last-read pointer). There is no explicit mark-read endpoint
// and none is invented — markThreadAsRead re-reads the thread so callers
// get the authoritative unread state after history was fetched.

const HISTORY_PAGE_LIMIT = 50
// Safety valve for the cursor loop — 40 pages ≈ 2000 messages per thread.
const MAX_HISTORY_PAGES = 40

// Backend MessageResponse → the frontend message model. Shapes are
// identical (id, threadId, senderId, body, attachments, read, createdAt).
function normalizeMessage(message) {
  if (!message) return null
  return {
    ...message,
    attachments: message.attachments ?? [],
  }
}

// Backend ThreadResponse → the frontend thread model. The one real
// difference: backend `lastMessage` is an OBJECT {id, body, senderId,
// createdAt} or null, while the frontend renders a plain preview STRING —
// normalized here, so no component ever sees the object form.
function normalizeThread(thread) {
  if (!thread) return null
  return {
    ...thread,
    participantIds: thread.participantIds ?? [],
    lastMessage: thread.lastMessage?.body ?? '',
    unreadCount: thread.unreadCount ?? 0,
  }
}

// GET /threads → envelope unwrapped, newest-activity first (backend
// ordering). `userId` is ignored — the backend scopes the list to the
// authenticated user; kept in the signature for existing callers.
export async function getThreads(_userId) {
  const page = await http.get('/threads?pageSize=100')
  return (page?.items ?? []).map(normalizeThread)
}

export async function getThreadById(threadId) {
  return normalizeThread(await http.get(`/threads/${threadId}`))
}

// POST /threads {participantId} — connected pair only (403 NOT_CONNECTED,
// 422 SELF_THREAD, 404 USER_NOT_FOUND); idempotent per pair (201 first
// time, 200 when an existing thread — including an accept-created one —
// is reused). `userIdA` is ignored; the pair is derived from auth + body.
export async function getOrCreateThread(_userIdA, userIdB) {
  return normalizeThread(await http.post('/threads', { participantId: userIdB }))
}

// Full history via cursor pagination: each page is oldest-first within the
// newest-`limit`-older-than-cursor window, so older pages are PREPENDED to
// build the complete ascending list the UI renders. Fetching history is
// also what marks the thread read (see header).
export async function getMessages(threadId) {
  const pages = []
  let before

  for (let call = 0; call < MAX_HISTORY_PAGES; call += 1) {
    const query = new URLSearchParams({ limit: String(HISTORY_PAGE_LIMIT) })
    if (before) query.set('before', before)

    const result = await http.get(`/threads/${threadId}/messages?${query.toString()}`)
    pages.unshift(result?.items ?? [])

    if (!result?.hasMore || !result?.nextCursor) break
    before = result.nextCursor
  }

  return pages.flat().map(normalizeMessage)
}

// No explicit read endpoint exists — fetching history marks the thread
// read server-side, so this just returns the authoritative thread state
// (fresh unreadCount) after that happened. `userId` kept for callers.
export async function markThreadAsRead(threadId, _userId) {
  return getThreadById(threadId)
}

// POST /threads/{id}/messages — sender comes from the auth user, never
// the body (the frontend `senderId` argument is dropped here).
export async function sendMessage({ threadId, senderId: _senderId, body }) {
  return normalizeMessage(await http.post(`/threads/${threadId}/messages`, { body }))
}
