import { http, refreshSession, setAccessToken } from './http'
import { listMockUsers } from './mockUserStore'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

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

// --- User lookup (real since Users/Profile integration; kept re-exported
//     here because many services/pages have always imported it from here).

export { getUserById } from './userService'

// TEMPORARY — the backend has no all-users listing endpoint (only
// GET /users/{id} and /search/people). Backs the mock People directory and
// mock search until those phases wire the real endpoints; seeded mock ids
// only, never real accounts.
export async function getAllUsers() {
  await delay(150)
  return listMockUsers()
}
