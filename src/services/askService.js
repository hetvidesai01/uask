import { categories } from '../mocks/categories'
import { http } from './http'
import { isBackendId } from './userService'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

// The UI has no pager, so listings fetch one large page (100 = backend max).
const PAGE_SIZE = 100

// Frontend filter keys → backend query params (the only naming differences).
const FILTER_PARAM_NAMES = {
  search: 'q',
  budgetMin: 'minBudget',
  budgetMax: 'maxBudget',
}

// Frontend sort values → backend AskSort values.
const SORT_NAMES = {
  deadline_soon: 'deadline',
}

// Backend AskResponse → the frontend ask model. Shapes are identical except
// `deadline` (backend date "YYYY-MM-DD" vs the frontend's ISO datetime) —
// normalized to the datetime form every page already sorts/renders with.
// Statuses are the same enum on both sides
// (open|matched|in_review|accepted|closed|cancelled).
function normalizeAsk(ask) {
  if (!ask) return null
  return {
    ...ask,
    deadline:
      typeof ask.deadline === 'string' && ask.deadline.length === 10
        ? `${ask.deadline}T00:00:00.000Z`
        : ask.deadline,
    attachments: ask.attachments ?? [],
  }
}

function toQuery(filters = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    const param = FILTER_PARAM_NAMES[key] ?? key
    const mapped = key === 'sort' ? (SORT_NAMES[value] ?? value) : value
    params.set(param, String(mapped))
  }
  params.set('pageSize', String(PAGE_SIZE))
  return params
}

// GET /asks → pagination envelope {items, …} unwrapped to a bare Ask[].
// No mock fallback: listings are backend data only.
export async function getAsks(filters = {}) {
  const page = await http.get(`/asks?${toQuery(filters).toString()}`)
  return (page?.items ?? []).map(normalizeAsk)
}

// TEMPORARY — no backend categories endpoint (frozen contract: the category
// label list is a frontend concern). Backs every category <Select>.
export async function getCategories() {
  await delay(150)
  return categories
}

// GET /asks/{id} → AskResponse; 404 → null (pages show their not-found
// state). Mock-era ids (ask-1 …, still referenced by not-yet-integrated
// mock features) return null without hitting the API — ASK data is
// backend-only now.
export async function getAskById(id) {
  if (!isBackendId(id)) return null
  try {
    return normalizeAsk(await http.get(`/asks/${id}`))
  } catch (error) {
    if (error?.status === 404) return null
    throw error
  }
}

// POST /asks (seeker role, backend-enforced) → 201. `requesterId` is
// derived from the auth user server-side; `deadline` is sent as a date.
export async function createAsk(data) {
  const { requesterId: _requesterId, ...rest } = data
  const payload = { ...rest }
  if (typeof payload.deadline === 'string') payload.deadline = payload.deadline.slice(0, 10)
  return normalizeAsk(await http.post('/asks', payload))
}

// PATCH /asks/{id} — owner only, only while the ASK is still editable
// (backend: accepted/closed/cancelled → 409 ASK_NOT_EDITABLE). Partial
// payload: only provided keys are sent (exclude_unset semantics).
export async function updateAsk(id, data) {
  const payload = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue
    payload[key] = key === 'deadline' && typeof value === 'string' ? value.slice(0, 10) : value
  }
  return normalizeAsk(await http.patch(`/asks/${id}`, payload))
}

// PATCH /asks/{id}/status — owner only; backend accepts → closed / →
// cancelled (accepted → closed only), same-status is idempotent.
export async function updateAskStatus(id, status) {
  return normalizeAsk(await http.patch(`/asks/${id}/status`, { status }))
}

// DELETE /asks/{id} — owner only, soft delete → 204.
export async function deleteAsk(id) {
  await http.delete(`/asks/${id}`)
  return null
}

// `responseCount` is derived server-side — there is no client-side counter
// to bump, so this re-reads the authoritative ask (return value currently
// unused by callers; AskDetails refetches on navigation anyway).
export async function incrementResponseCount(id) {
  return getAskById(id)
}
