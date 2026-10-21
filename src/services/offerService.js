import { offers } from '../mocks/offers'
import { http } from './http'
import { isBackendId } from './userService'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

// Backend OfferResponse → the frontend offer model. Shapes are identical
// (id, askId, providerId, price, currency, deliveryDays, pitch, deliverables,
// attachments, status, createdAt) and the status enum matches on both sides
// (pending|shortlisted|accepted|rejected). Identity map kept as the single
// place a future field rename would land.
function normalizeOffer(offer) {
  if (!offer) return null
  return {
    ...offer,
    deliverables: offer.deliverables ?? [],
    attachments: offer.attachments ?? [],
  }
}

// GET /asks/{id}/offers → pagination envelope unwrapped to Offer[]. Authz is
// handled server-side: the ASK owner sees every response, a provider sees
// only their own (so RespondToAsk's duplicate check keeps working), everyone
// else gets an empty list. Mock-era ask ids → [] without an API call.
export async function getOffersForAsk(askId) {
  if (!isBackendId(askId)) return []
  const page = await http.get(`/asks/${askId}/offers?pageSize=100`)
  return (page?.items ?? []).map(normalizeOffer)
}

// KNOWN GAP — the backend has no "offers submitted by this provider" listing
// (no /me/offers endpoint in the frozen contract). Dashboard's "My Offers"
// tab stays isolated on the mock store until the backend ships one; real
// accounts (UUID ids) never match mock provider ids, so the section renders
// its empty state honestly. Do NOT invent an endpoint for this.
export async function getOffersByProviderId(providerId) {
  await delay()
  return offers.filter((offer) => offer.providerId === providerId)
}

// POST /asks/{askId}/offers (provider role, backend-enforced) → 201.
// Backend re-checks: ASK must be open (409 ASK_NOT_OPEN), no duplicate
// response (409 DUPLICATE_OFFER), not your own ASK (403). `askId` and
// `providerId` travel via the path/auth user, not the body.
export async function createOffer(data) {
  const { askId, providerId: _providerId, ...payload } = data
  return normalizeOffer(await http.post(`/asks/${askId}/offers`, payload))
}

// PATCH /offers/{offer_id} {status} — owner-only for state transitions
// (shortlist: pending→shortlisted, reject: pending|shortlisted→rejected;
// backend rejects stale transitions with 409). Do NOT call this with
// 'accepted' — use acceptOffer so the atomic transaction is used.
export async function updateOfferStatus(offerId, status) {
  return normalizeOffer(await http.patch(`/offers/${offerId}`, { status }))
}

// THE acceptance flow — a single PATCH /offers/{offer_id} {status:'accepted'}
// that runs the backend's atomic transaction: offer accepted, competing
// offers rejected, ASK → accepted, thread created, draft contract + three
// stages created, notifications fanned out, one commit. Callers must NOT
// fake any of those steps separately.
export async function acceptOffer(offerId) {
  return normalizeOffer(await http.patch(`/offers/${offerId}`, { status: 'accepted' }))
}
