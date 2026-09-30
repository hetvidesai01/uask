import { portfolioItems } from '../mocks/portfolio'
import { getUserById } from './authService'
import { getConnectionStatus } from './connectionService'

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

// Mock-only for now — no upload flow yet, see mocks/portfolio.js.
export async function getPortfolioForUser(userId) {
  await delay()
  return portfolioItems.filter((item) => item.userId === userId)
}

// Contact & Socials are only shared between Connected users (or with the
// owner). Anyone else gets `null` — the fields are never returned.
export async function getContactDetails(viewerId, targetId) {
  if (viewerId !== targetId) {
    const { status } = await getConnectionStatus(viewerId, targetId)
    if (status !== 'connected') return null
  }

  const target = await getUserById(targetId)
  if (!target) return null

  return {
    linkedin: target.linkedin?.trim() || '',
    instagram: target.instagram?.trim() || '',
    contactEmail: target.contactEmail?.trim() || '',
  }
}
