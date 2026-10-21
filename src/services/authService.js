import { http, refreshSession, setAccessToken } from './http'
import { users as seedUsers } from '../mocks/users'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

// Mock user store. Since Phase 1 of the frontend integration, auth itself is
// real (login/signup/logout/restoreSession below go to the backend) — this
// array now only backs the not-yet-integrated profile/people helpers
// (getUserById, getAllUsers, updateUser), which a later phase replaces.
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

// The backend sends null for unset optional fields; the UI was built against
// empty strings, so normalize on the way in to keep rendering unchanged.
function normalizeUser(user) {
  if (!user) return null
  return {
    ...user,
    avatarUrl: user.avatarUrl ?? '',
    bio: user.bio ?? '',
    location: user.location ?? '',
    categories: user.categories ?? [],
  }
}

// --- Real backend auth (access token in memory, session in the refresh cookie)

export async function login({ email, password }) {
  const data = await http.post('/auth/login', { email, password }, { auth: false })
  setAccessToken(data.accessToken)
  return normalizeUser(data.user)
}

export async function signup({
  name,
  email,
  password,
  roles,
  termsAccepted,
  privacyAccepted,
}) {
  const data = await http.post(
    '/auth/signup',
    { name, email, password, roles, termsAccepted, privacyAccepted },
    { auth: false },
  )
  setAccessToken(data.accessToken)
  return normalizeUser(data.user)
}

export async function logout() {
  try {
    await http.post('/auth/logout')
  } catch {
    // Token already invalid/expired — local sign-out proceeds regardless.
  } finally {
    setAccessToken(null)
  }
}

// Startup/session restore: exchange the HttpOnly refresh cookie for an access
// token, then load the real user from /auth/me. Returns the user, or null when
// there is no valid session (stale localStorage users are cleared by callers).
export async function restoreSession() {
  try {
    await refreshSession()
    return normalizeUser(await http.get('/auth/me'))
  } catch {
    setAccessToken(null)
    return null
  }
}

// --- Still mock-backed (users/profiles integrate in a later phase)

export async function getUserById(id) {
  await delay(150)
  return users.find((user) => user.id === id) ?? null
}

// Full user list — backs People search/Discover People. Returns a copy so
// callers can't mutate the live `users` array directly.
export async function getAllUsers() {
  await delay(150)
  return [...users]
}

export async function updateUser(id, data) {
  await delay()

  const user = users.find((item) => item.id === id)
  if (!user) return null

  Object.assign(user, data)
  persistUsers()
  return user
}
