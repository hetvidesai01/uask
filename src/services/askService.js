import { asks } from '../mocks/asks'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getAsks(filters = {}) {
  await delay()

  return asks.filter((ask) => {
    if (filters.category && ask.category !== filters.category) return false
    if (filters.status && ask.status !== filters.status) return false
    if (filters.requesterId && ask.requesterId !== filters.requesterId) return false
    if (filters.isRemote !== undefined && ask.isRemote !== filters.isRemote) return false
    if (filters.search) {
      const term = filters.search.toLowerCase()
      const matches =
        ask.title.toLowerCase().includes(term) || ask.description.toLowerCase().includes(term)
      if (!matches) return false
    }
    return true
  })
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
