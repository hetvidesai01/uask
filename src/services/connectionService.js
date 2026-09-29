import { connections as seedConnections } from '../mocks/connections'

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

// Same runtime-persistence pattern as authService.js's `users` array —
// mutations (connect/remove) need to survive a reload, without touching
// the seeded mock array in place.
//
// UASK connections are immediate — Connect -> Connected in one click, no
// request/approval step. No "pending" state exists in this model.
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

// status: 'self' | 'none' | 'connected'
export async function getConnectionStatus(currentUserId, targetUserId) {
  await delay(150)

  if (currentUserId === targetUserId) return { status: 'self', connectionId: null }

  const record = findBetween(currentUserId, targetUserId)
  return record ? { status: 'connected', connectionId: record.id } : { status: 'none', connectionId: null }
}

export async function getConnectionCount(userId) {
  await delay(150)
  return connections.filter((record) => record.fromUserId === userId || record.toUserId === userId).length
}

// Raw connections for /app/connections — the page resolves user objects
// itself via authService, same composition pattern used elsewhere (e.g.
// AskDetails joining offers with provider profiles).
export async function getConnectionsForUser(userId) {
  await delay()

  return connections
    .filter((record) => record.fromUserId === userId || record.toUserId === userId)
    .map((record) => ({ connectionId: record.id, userId: otherPartyId(record, userId), since: record.connectedAt }))
    .sort((a, b) => new Date(b.since) - new Date(a.since))
}

// Immediate — no request/approval step. Connect -> Connected in one call.
export async function connectWithUser(fromUserId, toUserId) {
  await delay()

  const existing = findBetween(fromUserId, toUserId)
  if (existing) return existing

  const record = {
    id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fromUserId,
    toUserId,
    connectedAt: new Date().toISOString(),
  }
  connections.push(record)
  persistConnections()
  return record
}

export async function removeConnection(connectionId) {
  await delay()

  const index = connections.findIndex((item) => item.id === connectionId)
  if (index === -1) return false

  connections.splice(index, 1)
  persistConnections()
  return true
}
