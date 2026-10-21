import { users as seedUsers } from '../mocks/users'

// TEMPORARY — the mock-era user directory.
// Seeded asks/offers/threads/contracts still reference these ids (user-1 …)
// until those features are backend-backed; every user/profile adapter falls
// back here for non-UUID ids so those pages keep working. Real accounts are
// UUIDs and never live in this store. Delete this file when the last
// mock-data feature ships its integration phase.

const USERS_STORAGE_KEY = 'uask.mock.users'

function loadUsers() {
  try {
    const stored = window.localStorage.getItem(USERS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : [...seedUsers]
  } catch {
    return [...seedUsers]
  }
}

export const mockUsers = loadUsers()

export function findMockUserById(id) {
  return mockUsers.find((user) => user.id === id) ?? null
}

export function listMockUsers() {
  return [...mockUsers]
}
