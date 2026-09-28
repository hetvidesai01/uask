import { connections as seedConnections } from '../mocks/connections'

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

// Same runtime-persistence pattern as authService.js's `users` array —
// mutations (connect/accept/remove) need to survive a reload, without
// touching the seeded mock array in place.
const STORAGE_KEY = 'uask.connections'

function loadConnections() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : [...seedConnections]
  } catch {
    return [...seedConnections]
  }
}

function persistConnections() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connections))
  } catch {
    // Storage unavailable — mutations still work for this session.
  }
}

const connections = loadConnections()

function findBetween(userIdA, userIdB) {
  return connections.find(
    (record) =>
      (record.fromUserId === userIdA && record.toUserId === userIdB) ||
      (record.fromUserId === userIdB && record.toUserId === userIdA)
  )
}

function otherPartyId(record, userId) {
  return record.fromUserId === userId ? record.toUserId : record.fromUserId
}

// status: 'self' | 'none' | 'pending_outgoing' | 'pending_incoming' | 'connected'
export async function getConnectionStatus(currentUserId, targetUserId) {
  await delay(150)

  if (currentUserId === targetUserId) return { status: 'self', connectionId: null }

  const record = findBetween(currentUserId, targetUserId)
  if (!record) return { status: 'none', connectionId: null }
  if (record.status === 'accepted') return { status: 'connected', connectionId: record.id }

  return {
    status: record.fromUserId === currentUserId ? 'pending_outgoing' : 'pending_incoming',
    connectionId: record.id,
  }
}

export async function getConnectionCount(userId) {
  await delay(150)
  return connections.filter(
    (record) => record.status === 'accepted' && (record.fromUserId === userId || record.toUserId === userId)
  ).length
}

// Raw connection groups for /app/connections — the page resolves user
// objects itself via authService, same composition pattern used elsewhere
// (e.g. AskDetails joining offers with provider profiles).
export async function getConnectionsForUser(userId) {
  await delay()

  const connected = []
  const pendingIncoming = []
  const pendingOutgoing = []

  connections.forEach((record) => {
    if (record.fromUserId !== userId && record.toUserId !== userId) return

    if (record.status === 'accepted') {
      connected.push({
        connectionId: record.id,
        userId: otherPartyId(record, userId),
        since: record.respondedAt ?? record.createdAt,
      })
    } else if (record.toUserId === userId) {
      pendingIncoming.push({
        connectionId: record.id,
        userId: record.fromUserId,
        requestedAt: record.createdAt,
      })
    } else {
      pendingOutgoing.push({
        connectionId: record.id,
        userId: record.toUserId,
        requestedAt: record.createdAt,
      })
    }
  })

  connected.sort((a, b) => new Date(b.since) - new Date(a.since))
  pendingIncoming.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))
  pendingOutgoing.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))

  return { connected, pendingIncoming, pendingOutgoing }
}

export async function sendConnectionRequest(fromUserId, toUserId) {
  await delay()

  const existing = findBetween(fromUserId, toUserId)
  if (existing) {
    // They'd already requested us — accept immediately instead of a duplicate.
    if (existing.status === 'pending' && existing.fromUserId === toUserId) {
      existing.status = 'accepted'
      existing.respondedAt = new Date().toISOString()
      persistConnections()
    }
    return existing
  }

  const record = {
    id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fromUserId,
    toUserId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    respondedAt: null,
  }
  connections.push(record)
  persistConnections()
  return record
}

export async function acceptConnectionRequest(connectionId) {
  await delay()

  const record = connections.find((item) => item.id === connectionId)
  if (!record) return null

  record.status = 'accepted'
  record.respondedAt = new Date().toISOString()
  persistConnections()
  return record
}

// Also used to decline a pending incoming request and to cancel a pending
// outgoing one — both are just "delete this record" from the mock's POV.
export async function removeConnection(connectionId) {
  await delay()

  const index = connections.findIndex((item) => item.id === connectionId)
  if (index === -1) return false

  connections.splice(index, 1)
  persistConnections()
  return true
}
