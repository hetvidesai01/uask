import { offers } from '../mocks/offers'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getOffersForAsk(askId) {
  await delay()
  return offers.filter((offer) => offer.askId === askId)
}

export async function getOffersByIds(ids) {
  await delay()
  return offers.filter((offer) => ids.includes(offer.id))
}

export async function createOffer(data) {
  await delay()

  const newOffer = {
    id: `offer-${offers.length + 1}`,
    currency: 'USD',
    deliverables: [],
    attachments: [],
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...data,
  }

  offers.push(newOffer)
  return newOffer
}

export async function updateOfferStatus(offerId, status) {
  await delay()

  const offer = offers.find((item) => item.id === offerId)
  if (!offer) return null

  offer.status = status
  return offer
}
