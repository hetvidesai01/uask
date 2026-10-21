import { portfolioItems } from '../mocks/portfolio'
import { ApiError, http } from './http'
import { isBackendId } from './userService'
import { findMockUserById } from './mockUserStore'
import { getConnectionStatus } from './connectionService'

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

// TEMPORARY (no backend endpoint) — portfolio is still the seeded mock.
// Backend uploads now exist (uploadService → POST /uploads), but this build
// has no portfolio-item editor, so there is nothing to wire them to yet.
export async function getPortfolioForUser(userId) {
  await delay()
  return portfolioItems.filter((item) => item.userId === userId)
}

// Contact & Socials privacy. The backend is authoritative: GET
// /users/{id}/contact serves the owner or connected users only and 403s
// everyone else — mapped to `null` here so the UI shows nothing (same shape
// as the old mock rule; ContactCard renders no rows for null details).
// TEMPORARY: mock-era ids keep the local owner-or-connected check against the
// mock store until their data is backend-backed.
export async function getContactDetails(viewerId, targetId) {
  if (!isBackendId(targetId)) {
    if (viewerId !== targetId) {
      const { status } = await getConnectionStatus(viewerId, targetId)
      if (status !== 'connected') return null
    }

    const target = findMockUserById(targetId)
    if (!target) return null

    return {
      linkedin: target.linkedin?.trim() || '',
      instagram: target.instagram?.trim() || '',
      contactEmail: target.contactEmail?.trim() || '',
    }
  }

  try {
    const contact = await http.get(`/users/${targetId}/contact`)
    return {
      linkedin: contact?.linkedin?.trim() || '',
      instagram: contact?.instagram?.trim() || '',
      contactEmail: contact?.contactEmail?.trim() || '',
    }
  } catch (error) {
    // 403 NOT_CONNECTED (not owner/connection) or 404 — no details to show.
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return null
    }
    throw error
  }
}
