import { messages, threads } from '../mocks/messages'

// Threads/messages created at runtime (e.g. starting a chat from a profile)
// are persisted so they survive a reload; the seeded conversations stay
// exactly as they are in mocks/messages.js.
const EXTRA_STORAGE_KEY = 'uask.messages.extra'
const extraThreads = []
const extraMessages = []

try {
  const stored = JSON.parse(window.localStorage.getItem(EXTRA_STORAGE_KEY) || 'null')
  if (stored) {
    extraThreads.push(...stored.threads)
    extraMessages.push(...stored.messages)
    threads.push(...stored.threads)
    messages.push(...stored.messages)
  }
} catch {
  // Storage unavailable or corrupt — fall back to the seeded data only.
}

function persistExtras() {
  try {
    window.localStorage.setItem(
      EXTRA_STORAGE_KEY,
      JSON.stringify({ threads: extraThreads, messages: extraMessages })
    )
  } catch {
    // Storage unavailable — the thread still works for this session.
  }
}

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getThreads(userId) {
  await delay()

  return threads
    .filter((thread) => thread.participantIds.includes(userId))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

// Reuses any existing thread between the two users (contract-related or
// not) so opening "Message" never creates duplicates; otherwise starts an
// empty direct thread with no ASK attached.
export async function getOrCreateThread(userIdA, userIdB) {
  await delay(150)

  const existing = threads
    .filter((thread) => thread.participantIds.includes(userIdA) && thread.participantIds.includes(userIdB))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]
  if (existing) return existing

  const thread = {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    participantIds: [userIdA, userIdB],
    askId: null,
    lastMessage: '',
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
  }
  threads.push(thread)
  extraThreads.push(thread)
  persistExtras()
  return thread
}

export async function getThreadById(threadId) {
  await delay()
  return threads.find((thread) => thread.id === threadId) ?? null
}

export async function getMessages(threadId) {
  await delay()

  return messages
    .filter((message) => message.threadId === threadId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

export async function markThreadAsRead(threadId, userId) {
  await delay(150)

  messages
    .filter((message) => message.threadId === threadId && message.senderId !== userId)
    .forEach((message) => {
      message.read = true
    })

  const thread = threads.find((item) => item.id === threadId)
  if (thread) {
    thread.unreadCount = 0
  }

  return thread ?? null
}

export async function sendMessage({ threadId, senderId, body }) {
  await delay()

  const newMessage = {
    id: `message-${messages.length + 1}`,
    threadId,
    senderId,
    body,
    attachments: [],
    createdAt: new Date().toISOString(),
    read: true,
  }
  messages.push(newMessage)
  if (extraThreads.some((item) => item.id === threadId)) {
    extraMessages.push(newMessage)
  }

  const thread = threads.find((item) => item.id === threadId)
  if (thread) {
    thread.lastMessage = body
    thread.updatedAt = newMessage.createdAt
    if (extraThreads.includes(thread)) persistExtras()
  }

  return newMessage
}
