// Frontend/mock global search — composes existing services rather than
// touching mocks directly, so search results always reflect whatever
// askService/authService already know (including runtime-created ASKs and
// signed-up users). Swap the bodies below for real API calls later; the
// (query, { limit }) -> results shape is what every caller (GlobalSearch,
// SearchResults, Discover) already depends on.
//
// Explicitly not: Elasticsearch/Algolia/Meilisearch or any other external
// search engine — plain substring matching over mock/service data only.
import { getAsks } from './askService'
import { getAllUsers } from './authService'
import { getProfileHeadline } from '../utils/profileHeadline'

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

function normalizedTerm(query) {
  return (query ?? '').trim().toLowerCase()
}

function matchesAny(fields, term) {
  return fields.some((field) => typeof field === 'string' && field.toLowerCase().includes(term))
}

export async function searchAsks(query, { limit } = {}) {
  await delay()

  const term = normalizedTerm(query)
  if (!term) return []

  const allAsks = await getAsks({})
  const matches = allAsks.filter((ask) => matchesAny([ask.title, ask.description, ask.category], term))

  return typeof limit === 'number' ? matches.slice(0, limit) : matches
}

export async function searchPeople(query, { limit, excludeUserId } = {}) {
  await delay()

  const term = normalizedTerm(query)
  if (!term) return []

  const allUsers = await getAllUsers()
  const matches = allUsers.filter((user) => {
    if (excludeUserId && user.id === excludeUserId) return false
    return matchesAny(
      [user.name, getProfileHeadline(user), user.bio, user.location, ...(user.categories ?? [])],
      term
    )
  })

  return typeof limit === 'number' ? matches.slice(0, limit) : matches
}

// Combined lookup for the topbar dropdown and the /app/search "All" tab.
export async function searchAll(query, { limit, excludeUserId } = {}) {
  const [asks, people] = await Promise.all([
    searchAsks(query, { limit }),
    searchPeople(query, { limit, excludeUserId }),
  ])
  return { asks, people }
}
