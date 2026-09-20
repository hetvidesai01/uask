import { messages, threads } from '../mocks/messages'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getThreads(userId) {
  await delay()

  return threads
    .filter((thread) => thread.participantIds.includes(userId))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
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

  const thread = threads.find((item) => item.id === threadId)
  if (thread) {
    thread.lastMessage = body
    thread.updatedAt = newMessage.createdAt
  }

  return newMessage
}
