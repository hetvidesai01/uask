// Matching service.
//
// Responder ranking is BACKEND-owned (Backend Contract Alignment Phase 3):
//
//   GET /asks/{askId}/ranked-responses   (ASK owner only, read-only)
//
// Deterministic scoring of the responses actually submitted to that ASK —
// the wider provider directory is never ranked, no winner is selected, and
// nothing is written. The frozen contract (API_CONTRACT.md) fixes the
// weights at 100 total: category relevance 30, similar projects 25,
// rating/reviews 15, budget fit 10, timeline fit 10, profile booster 10;
// labels >=80 "Excellent Match", >=55 "Strong Match", else "Relevant";
// reasons <=3 favourable factors; strengths ("Best value", "Fastest
// delivery", "Highest rated", "Strongest portfolio fit") only for the
// unique holder among >=2 responses. Signals that do not exist yet score
// a neutral 50 and `similarProjectCount` comes back `null` — never faked.
// This module is a thin adapter: it normalizes the API shape into the
// frontend matching model; scores/labels/reasons are NEVER computed here.
//
// Provider-side ASK discovery ("Recommended for you" in Discover) stays a
// LOCAL, deterministic heuristic — see getRecommendedAsksForProvider for
// why the backend endpoint is deliberately not used there.
import { getAskById, getAsks } from './askService'
import { getUserById } from './authService'
import { getProviderReputation, getCompletedContractsForProvider } from './contractService'
import { getPortfolioForUser } from './profileService'
import { getOffersByProviderId } from './offerService'
import { http } from './http'
import { isBackendId } from './userService'

// Backend RankedResponse → the frontend ranked-response model. Shapes are
// already identical ({offer, provider, score, label, reasons, rating,
// similarProjectCount, strength} — camelCase on the wire); only defensive
// array/null defaults are applied here.
function normalizeRankedResponse(item) {
  if (!item) return null
  return {
    ...item,
    offer: item.offer
      ? {
          ...item.offer,
          deliverables: item.offer.deliverables ?? [],
          attachments: item.offer.attachments ?? [],
        }
      : item.offer,
    provider: item.provider ?? null,
    reasons: item.reasons ?? [],
    similarProjectCount: item.similarProjectCount ?? null,
  }
}

// Compare Responses' data source. Backend-enforced owner-only (everyone
// else gets 403 NOT_ASK_OWNER — the page also gates on ownership before
// calling). Returns responses already ranked by score desc, each shaped
// { offer, provider, score, label, reasons, rating, similarProjectCount,
// strength }. Mock-era ask ids → [] without an API call.
export async function rankResponses(askId) {
  if (!isBackendId(askId)) return []
  const ranked = await http.get(`/asks/${askId}/ranked-responses`)
  return (ranked ?? []).map(normalizeRankedResponse)
}

async function getSimilarProjectCounts(providerId, category) {
  const [completedContracts, portfolioItems] = await Promise.all([
    getCompletedContractsForProvider(providerId),
    getPortfolioForUser(providerId),
  ])

  const completedAsks = await Promise.all(completedContracts.map((contract) => getAskById(contract.askId)))
  const completedInCategory = completedAsks.filter((completedAsk) => completedAsk?.category === category).length
  const portfolioInCategory = portfolioItems.filter((item) => item.category === category).length

  return { completedInCategory, portfolioInCategory }
}

function getMatchLabel(score) {
  if (score >= 80) return 'Excellent Match'
  if (score >= 55) return 'Strong Match'
  return 'Relevant'
}

// Provider-side "Recommended for you" in Discover ASKs — deliberately kept
// lightweight and separate from responder ranking: no offer exists yet, so
// budget/timeline can't be evaluated against a real quote. This is
// relevance discovery to help a provider find ASKs worth responding to,
// not a ranking of people.
//
// KNOWN DISTINCTION (documented, per the integration contract): the
// backend's `GET /me/recommended-asks` returns bare Ask[] with NO
// score/label/reasons. The recommended card's design needs all three, and
// every backend candidate already matches one of the provider's own
// categories — scoring that pre-filtered list client-side would show
// near-constant numbers, i.e. fabricated-looking AI precision. So the
// backend endpoint is NOT used for this card: selection AND scoring stay
// the transparent local heuristic below, computed over real backend data
// (open ASKs, profile, real reputation).
const DISCOVERY_WEIGHTS = { category: 40, similarProjects: 25, rating: 20, booster: 15 }

async function scoreForDiscovery(ask, provider, reputation, similarCounts) {
  const matched = Boolean(provider.categories?.includes(ask.category))
  const categoryPoints = matched ? DISCOVERY_WEIGHTS.category : 0

  const similarCount = similarCounts.completedInCategory + Math.min(similarCounts.portfolioInCategory, 2)
  const similarPoints = Math.min(similarCount, 5) * (DISCOVERY_WEIGHTS.similarProjects / 5)

  const rating = reputation?.averageRating ?? provider.rating ?? null
  const ratingPoints = rating == null ? DISCOVERY_WEIGHTS.rating * 0.4 : DISCOVERY_WEIGHTS.rating * Math.min(rating / 5, 1)

  const boosterPct = reputation?.profileBoosterPct ?? 0
  const boosterPoints = (Math.min(boosterPct, 20) / 20) * DISCOVERY_WEIGHTS.booster

  const score = Math.round(Math.max(0, Math.min(100, categoryPoints + similarPoints + ratingPoints + boosterPoints)))

  const reasons = []
  if (matched) reasons.push(`${ask.category} skill match`)
  if (rating != null) reasons.push(`${rating.toFixed(1)}★ rating`)
  if (similarCounts.completedInCategory > 0) {
    reasons.push(`${similarCounts.completedInCategory} similar completed`)
  }
  if (ask.isRemote) reasons.push('Remote')

  return { score, label: getMatchLabel(score), reasons: reasons.slice(0, 3) }
}

export async function getRecommendedAsksForProvider(providerId, { limit = 6 } = {}) {
  const provider = await getUserById(providerId)
  if (!provider) return []

  const [openAsks, myOffers, reputation] = await Promise.all([
    getAsks({ status: 'open' }),
    // TEMPORARY (known gap): no backend "my offers" listing yet — this
    // stays on the isolated mock store, so the already-responded exclusion
    // below only works for mock-era ids. Real accounts may see an ASK they
    // already answered. Remove once the backend ships a /me/offers endpoint.
    getOffersByProviderId(providerId),
    getProviderReputation(providerId),
  ])

  const respondedAskIds = new Set(myOffers.map((offer) => offer.askId))
  const candidates = openAsks.filter(
    (candidateAsk) => candidateAsk.requesterId !== providerId && !respondedAskIds.has(candidateAsk.id)
  )

  const results = await Promise.all(
    candidates.map(async (candidateAsk) => {
      const similarCounts = await getSimilarProjectCounts(providerId, candidateAsk.category)
      const match = await scoreForDiscovery(candidateAsk, provider, reputation, similarCounts)
      return { ask: candidateAsk, ...match }
    })
  )

  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}
