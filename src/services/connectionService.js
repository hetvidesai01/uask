import { connections as seedConnections } from '../mocks/connections'
import { http } from './http'
import { isBackendId } from './userService'

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

// UASK connections are immediate — Connect -> Connected in one click, no
// request/approval step. No "pending" state exists in this model.
//
// Real users (UUID ids) are fully backend-owned:
//   GET  /users/{id}/connections            → connection listing (envelope)
//   GET  /users/{id}/connections/count      → profile stat
//   GET  /connections/status/{targetUserId} → {status, connectionId}
//   POST /connections {toUserId}            → 201 first time, 200 on repeat
//   DELETE /connections/{connectionId}      → 204
//
// TEMPORARY — the People directory is still the mock store (no backend
// all-users listing), so any call involving a mock-era id keeps the local
// demo behavior below. Those local connections never appear in the
// backend-backed Connections page. Remove this whole mock path together
// with mocks/connections.js when the People directory ships.
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

function isMockEra(...ids) {
  return ids.some((id) => !isBackendId(id))
}

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
  if (currentUserId === targetUserId) return { status: 'self', connectionId: null }

  if (isMockEra(currentUserId, targetUserId)) {
    await delay(150)
    const record = findBetween(currentUserId, targetUserId)
    return record ? { status: 'connected', connectionId: record.id } : { status: 'none', connectionId: null }
  }

  const result = await http.get(`/connections/status/${targetUserId}`)
  return { status: result?.status ?? 'none', connectionId: result?.connectionId ?? null }
}

export async function getConnectionCount(userId) {
  if (isMockEra(userId)) {
    await delay(150)
    return connections.filter((record) => record.fromUserId === userId || record.toUserId === userId).length
  }

  const result = await http.get(`/users/${userId}/connections/count`)
  return result?.count ?? 0
}

// Raw connections for /app/connections — the page resolves user objects
// itself via authService, same composition pattern used elsewhere (e.g.
// AskDetails joining offers with provider profiles). Backend rows carry
// viewer-side aliases (connectionId/userId/since) so the mapping is a
// straight pass-through; sorted newest-first like the old mock list.
export async function getConnectionsForUser(userId) {
  if (isMockEra(userId)) {
    await delay()
    return connections
      .filter((record) => record.fromUserId === userId || record.toUserId === userId)
      .map((record) => ({ connectionId: record.id, userId: otherPartyId(record, userId), since: record.connectedAt }))
      .sort((a, b) => new Date(b.since) - new Date(a.since))
  }

  const page = await http.get(`/users/${userId}/connections?pageSize=100`)
  return (page?.items ?? [])
    .map((item) => ({
      connectionId: item.connectionId ?? item.id,
      userId: item.userId ?? item.connectedUserId,
      since: item.since ?? item.createdAt,
    }))
    .sort((a, b) => new Date(b.since) - new Date(a.since))
}

// Immediate — no request/approval step. Connect -> Connected in one call.
// Backend is idempotent per pair (201 first time, 200 on repeat).
export async function connectWithUser(fromUserId, toUserId) {
  if (isMockEra(fromUserId, toUserId)) {
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

  const created = await http.post('/connections', { toUserId })
  return {
    connectionId: created?.connectionId ?? created?.id,
    userId: created?.userId ?? created?.connectedUserId,
    since: created?.since ?? created?.createdAt,
  }
}

export async function removeConnection(connectionId) {
  if (isMockEra(connectionId)) {
    await delay()
    const index = connections.findIndex((item) => item.id === connectionId)
    if (index === -1) return false

    connections.splice(index, 1)
    persistConnections()
    return true
  }

  await http.delete(`/connections/${connectionId}`)
  return true
}
