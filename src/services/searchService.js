// Backend-backed global search — the three frozen endpoints:
//
//   GET /search/asks?q=&limit=   → bare Ask[]
//   GET /search/people?q=&limit= → bare UserProfile[]
//   GET /search?q=&limit=        → { asks, people }
//
// All matching is backend-owned: ASKs by title/description/category/budget,
// people by name/bio/location/skills (categories) — which is where the
// "skills/categories" side of search is served. The adapter only preserves
// contract behavior the old local search had:
// - empty/whitespace terms return [] without an API call (the API does the
//   same for missing terms, and avoids sending a pointless request);
// - terms are capped at the contract's 200-char max so typing a long string
//   can't produce a 422;
// - `limit` is clamped to the API's 1-50 range, defaulting to 50 — callers
//   that previously saw every local match (SearchResults) now see the
//   backend's full first page within its cap;
// - callers may still pass `excludeUserId` for parity with the old local
//   search: it is IGNORED, because the API already excludes the calling
//   user (and inactive users) from people results.
import { http } from './http'
import { normalizeAsk } from './askService'

const MAX_LIMIT = 50 // backend limit range is 1-50
const TERM_MAX = 200 // backend term max_length

function toQuery(query, limit) {
  const term = String(query ?? '').trim().slice(0, TERM_MAX)
  if (!term) return null
  const requested = Number(limit)
  const capped = Math.min(Math.max(Number.isFinite(requested) ? requested : MAX_LIMIT, 1), MAX_LIMIT)
  return new URLSearchParams({ q: term, limit: String(capped) }).toString()
}

// UserProfile → the frontend person model, with the same null → '' rule as
// the other profile adapters (the UI renders empty strings for these).
function normalizePerson(person) {
  if (!person) return null
  return {
    ...person,
    avatarUrl: person.avatarUrl ?? '',
    bio: person.bio ?? '',
    location: person.location ?? '',
    categories: person.categories ?? [],
  }
}

export async function searchAsks(query, { limit } = {}) {
  const qs = toQuery(query, limit)
  if (!qs) return []
  const asks = await http.get(`/search/asks?${qs}`)
  return (asks ?? []).map(normalizeAsk)
}

export async function searchPeople(query, { limit } = {}) {
  const qs = toQuery(query, limit)
  if (!qs) return []
  const people = await http.get(`/search/people?${qs}`)
  return (people ?? []).map(normalizePerson)
}

export async function searchAll(query, { limit } = {}) {
  const qs = toQuery(query, limit)
  if (!qs) return { asks: [], people: [] }
  const result = await http.get(`/search?${qs}`)
  return {
    asks: (result?.asks ?? []).map(normalizeAsk),
    people: (result?.people ?? []).map(normalizePerson),
  }
}
