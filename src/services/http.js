// Shared HTTP layer for every backend-backed service.
//
// Contract (see API_CONTRACT.md):
// - JSON in/out, camelCase keys. Every request sends `credentials: "include"`
//   so the HttpOnly refresh cookie travels cross-origin (Vercel -> Render).
// - The access token lives in MEMORY only (module state below) — never
//   localStorage. The refresh cookie is the session; the token is derived.
// - Errors arrive as { error: { code, message, details, requestId } } and are
//   normalized into ApiError with those fields (+ HTTP status).
// - A 401 triggers ONE silent refresh + retry; the retried request never
//   refreshes again and refresh itself is never retried, so refresh loops are
//   structurally impossible. Concurrent refreshes are coalesced (StrictMode
//   double-mount, parallel 401s).
// - VITE_API_URL is the API base (trailing slash tolerated). Local dev falls
//   back to the staging API; a production build without the variable fails
//   loudly instead of guessing.

const STAGING_API_BASE = 'https://uask-backend-staging-sb2d.onrender.com/api/v1'

const envUrl = import.meta.env.VITE_API_URL
const API_BASE = (envUrl || (import.meta.env.DEV ? STAGING_API_BASE : '')).replace(/\/+$/, '')

let accessToken = null
let refreshInFlight = null

export function setAccessToken(token) {
  accessToken = token || null
}

export function getAccessToken() {
  return accessToken
}

export class ApiError extends Error {
  constructor(status, envelope) {
    super(
      envelope?.message ||
        (status === 0
          ? 'Could not reach the server.'
          : `Request failed (${status}).`),
    )
    this.name = 'ApiError'
    this.status = status
    this.code = envelope?.code ?? null
    this.details = envelope?.details ?? null
    this.requestId = envelope?.requestId ?? null
  }
}

async function request(
  path,
  { method = 'GET', body, formData, auth = true, headers = {}, retry = true } = {},
) {
  if (!API_BASE) {
    throw new ApiError(0, {
      code: 'MISCONFIGURED',
      message: 'VITE_API_URL is not configured for this build.',
    })
  }

  const finalHeaders = { Accept: 'application/json', ...headers }
  let payload
  if (formData) {
    payload = formData // browser sets the multipart boundary itself
  } else if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  if (auth && accessToken) {
    finalHeaders.Authorization = `Bearer ${accessToken}`
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: finalHeaders,
      credentials: 'include',
      body: payload,
    })
  } catch {
    // Network/CORS failure — fetch rejects before an HTTP status exists.
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.',
    })
  }

  if (response.status === 204 || response.status === 205) return null

  const text = await response.text()
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }

  if (!response.ok) {
    const error = new ApiError(response.status, json?.error ?? null)
    const expired =
      response.status === 401 &&
      (error.code === 'TOKEN_EXPIRED' || error.code === 'UNAUTHORIZED')
    // Silent re-auth for authenticated calls: refresh once via the cookie,
    // then replay the original request exactly one time.
    if (auth && retry && expired) {
      try {
        await refreshSession()
      } catch {
        throw error
      }
      return request(path, { method, body, formData, auth, headers, retry: false })
    }
    throw error
  }
  return json
}

// Exchanges the HttpOnly refresh cookie for a fresh access token. Single-flight:
// concurrent callers (StrictMode double-mount, parallel 401s) share one request.
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = request('/auth/refresh', { method: 'POST', auth: false, retry: false })
      .then((data) => {
        if (!data?.accessToken) {
          setAccessToken(null)
          throw new ApiError(401, {
            code: 'NO_REFRESH_SESSION',
            message: 'Your session has expired.',
          })
        }
        setAccessToken(data.accessToken)
        return accessToken
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

// Convenience verbs for services (Phase 2+). `auth: false` skips the token.
export const http = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  postForm: (path, formData, options) =>
    request(path, { ...options, method: 'POST', formData }),
}
