import { users as seedUsers } from '../mocks/users'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

// Login/signup/profile edits mutate `users` at runtime (see login, signup,
// updateUser below). Without persisting that array, it would silently
// reset to the seed data on every reload — AuthContext's own localStorage
// key (`uask.auth.user`) still remembers who's logged in, but a user
// created via signup, or via logging in with an email that doesn't match
// one of the 3 seeded accounts, would no longer exist in `users` after a
// refresh. getUserById(currentUser.id) would then return null, and the
// Profile page would show "Profile not found" for that user's own profile.
const USERS_STORAGE_KEY = 'uask.mock.users'

function loadUsers() {
  try {
    const stored = window.localStorage.getItem(USERS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : [...seedUsers]
  } catch {
    return [...seedUsers]
  }
}

function persistUsers() {
  try {
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
  } catch {
    // Storage unavailable (private mode, quota, etc.) — mutations still
    // work for this session, they just won't survive a reload.
  }
}

const users = loadUsers()

// Builds a human-readable display name from an email's local part for a
// mock login that doesn't match a seeded user (see login() below). Splits
// on any run of non-letter characters (dots, underscores, digits, etc.) so
// "jane.doe99@x.com" becomes "Jane Doe" instead of a raw, digit-laden
// handle like "Janedoe99".
function nameFromEmail(email) {
  const [handle] = email.split('@')
  const words = handle
    .split(/[^a-zA-Z]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())

  return words.length > 0 ? words.join(' ') : 'UASK User'
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

  const newUser = {
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
  users.push(newUser)
  persistUsers()
  return newUser
}

export async function updateUser(id, data) {
  await delay()

  const user = users.find((item) => item.id === id)
  if (!user) return null

  Object.assign(user, data)
  persistUsers()
  return user
}

export async function signup({ name, email, roles }) {
  await delay()

  const newUser = {
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
  users.push(newUser)
  persistUsers()
  return newUser
}
