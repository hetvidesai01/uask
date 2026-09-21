import { asks } from '../mocks/asks'
import { categories } from '../mocks/categories'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

const POSTED_WITHIN_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

const SORTERS = {
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  budget_high: (a, b) => b.budgetMax - a.budgetMax,
  budget_low: (a, b) => a.budgetMin - b.budgetMin,
  deadline_soon: (a, b) => new Date(a.deadline) - new Date(b.deadline),
}

export async function getAsks(filters = {}) {
  await delay()

  const results = asks.filter((ask) => {
    if (filters.category && ask.category !== filters.category) return false
    if (filters.status && ask.status !== filters.status) return false
    if (filters.requesterId && ask.requesterId !== filters.requesterId) return false
    if (filters.isRemote !== undefined && ask.isRemote !== filters.isRemote) return false
    if (filters.location) {
      const term = filters.location.toLowerCase()
      if (!ask.location.toLowerCase().includes(term)) return false
    }
    if (filters.budgetMin !== undefined && ask.budgetMax < filters.budgetMin) return false
    if (filters.budgetMax !== undefined && ask.budgetMin > filters.budgetMax) return false
    if (filters.postedWithin && POSTED_WITHIN_MS[filters.postedWithin]) {
      const age = Date.now() - new Date(ask.createdAt).getTime()
      if (age > POSTED_WITHIN_MS[filters.postedWithin]) return false
    }
    if (filters.search) {
      const term = filters.search.toLowerCase()
      const matches =
        ask.title.toLowerCase().includes(term) || ask.description.toLowerCase().includes(term)
      if (!matches) return false
    }
    return true
  })

  const sorter = SORTERS[filters.sort] || SORTERS.newest
  return results.sort(sorter)
}

export async function getCategories() {
  await delay(150)
  return categories
}

export async function getAskById(id) {
  await delay()
  return asks.find((ask) => ask.id === id) ?? null
}

export async function createAsk(data) {
  await delay()

  const newAsk = {
    id: `ask-${asks.length + 1}`,
    status: 'open',
    attachments: [],
    responseCount: 0,
    createdAt: new Date().toISOString(),
    ...data,
  }

  asks.push(newAsk)
  return newAsk
}
