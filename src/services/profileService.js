import { portfolioItems } from '../mocks/portfolio'

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

// Mock-only for now — no upload flow yet, see mocks/portfolio.js.
export async function getPortfolioForUser(userId) {
  await delay()
  return portfolioItems.filter((item) => item.userId === userId)
}
