import { users } from '../mocks/users'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

function nameFromEmail(email) {
  const [handle] = email.split('@')
  return handle.charAt(0).toUpperCase() + handle.slice(1)
}

function findByEmail(email) {
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase())
}

export async function getUserById(id) {
  await delay(150)
  return users.find((user) => user.id === id) ?? null
}

// Mock login: no backend, so any password is accepted. If the email
// matches one of the seeded mock users, that profile is returned;
// otherwise a minimal profile is fabricated from the email.
export async function login({ email }) {
  await delay()

  const existing = findByEmail(email)
  if (existing) return existing

  return {
    id: crypto.randomUUID(),
    name: nameFromEmail(email),
    email,
    avatarUrl: '',
    roles: ['seeker'],
    bio: '',
    location: '',
    categories: [],
    rating: null,
    reviewCount: 0,
    joinedAt: new Date().toISOString(),
  }
}

export async function signup({ name, email, roles }) {
  await delay()

  return {
    id: crypto.randomUUID(),
    name,
    email,
    avatarUrl: '',
    roles,
    bio: '',
    location: '',
    categories: [],
    rating: null,
    reviewCount: 0,
    joinedAt: new Date().toISOString(),
  }
}
