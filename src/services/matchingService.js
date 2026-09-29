// AI Matching Engine — Phase 1 frontend prototype (corrected model).
//
// UASK's matching intelligence evaluates ACTUAL responders, not random
// providers before anyone has responded:
//
//   ASK posted -> providers respond -> UASK ranks only the responders
//
// This is deterministic and rule-based over existing mock/service data —
// explicitly NOT a real model call (no embeddings, no external API). Every
// score is just the sum of a handful of named, capped point contributions,
// and the same inputs always produce the same output.
//
// Swap point: a real backend matching endpoint would replace the body of
// rankResponses / getRecommendedAsksForProvider below (same signatures,
// same return shape) — everything importing this service stays unchanged.
import { getAskById, getAsks } from './askService'
import { getUserById } from './authService'
import { getProviderReputation, getCompletedContractsForProvider } from './contractService'
import { getPortfolioForUser } from './profileService'
import { getOffersByProviderId } from './offerService'

// Centralized weights — the ONLY place score contributions are defined.
// Components never hardcode point values.
const WEIGHTS = {
  category: 30, // Skill/category relevance
  similarProjects: 25, // Similar completed projects (contracts + portfolio, same category)
  rating: 15, // Rating / reviews
  budget: 10, // Budget compatibility
  timeline: 10, // Delivery / timeline fit
  booster: 10, // Reliability / Profile Booster
}

// Thresholds tuned against the seeded demo data's real score ceiling — a
// genuine category match with a strong track record and a fitting offer
// tops out in the mid-90s; nothing here is fake precision (score is
// always Math.round()'d before this runs).
function getMatchLabel(score) {
  if (score >= 80) return 'Excellent Match'
  if (score >= 55) return 'Strong Match'
  return 'Relevant'
}

function scoreCategory(ask, provider) {
  const matched = Boolean(provider.categories?.includes(ask.category))
  return { points: matched ? WEIGHTS.category : 0, matched }
}

function scoreSimilarProjects({ completedInCategory, portfolioInCategory }) {
  const count = completedInCategory + Math.min(portfolioInCategory, 2)
  const points = Math.min(count, 5) * (WEIGHTS.similarProjects / 5)
  return { points, completedInCategory, portfolioInCategory }
}

function scoreRating(reputation, provider) {
  const rating = reputation?.averageRating ?? provider.rating ?? null
  if (rating == null) return { points: WEIGHTS.rating * 0.4, rating: null }
  return { points: WEIGHTS.rating * Math.min(rating / 5, 1), rating }
}

function scoreBooster(reputation) {
  const pct = reputation?.profileBoosterPct ?? 0
  return { points: (Math.min(pct, 20) / 20) * WEIGHTS.booster, pct }
}

// Budget/timeline are scored against the ACTUAL submitted offer's price
// and delivery days — a real quote is a far better signal than a
// historical average. There's no equivalent for the provider-discovery
// case (getRecommendedAsksForProvider) since no offer exists yet there,
// which is exactly why that path skips these two signals entirely.
function scoreBudget(ask, price) {
  if (price == null) return { points: WEIGHTS.budget * 0.55, fits: null }
  if (price >= ask.budgetMin && price <= ask.budgetMax) return { points: WEIGHTS.budget, fits: true }

  const nearestBound = price < ask.budgetMin ? ask.budgetMin : ask.budgetMax
  const distanceRatio = nearestBound > 0 ? Math.abs(price - nearestBound) / nearestBound : 1
  if (distanceRatio <= 0.25) return { points: WEIGHTS.budget * 0.55, fits: 'close' }
  return { points: WEIGHTS.budget * 0.15, fits: false }
}

function scoreTimeline(ask, deliveryDays) {
  const daysUntilDeadline = Math.max(0, (new Date(ask.deadline).getTime() - Date.now()) / 86400000)
  if (deliveryDays == null) return { points: WEIGHTS.timeline * 0.6, fits: null }
  if (deliveryDays <= daysUntilDeadline) return { points: WEIGHTS.timeline, fits: true }
  if (deliveryDays <= daysUntilDeadline * 1.3) return { points: WEIGHTS.timeline * 0.5, fits: 'close' }
  return { points: WEIGHTS.timeline * 0.15, fits: false }
}

function buildReasons({ ask, category, similar, rating, budget, timeline, booster }) {
  const candidates = []

  if (category.matched) {
    candidates.push({ text: `Strong ${ask.category.toLowerCase()} skill match`, points: category.points })
  }
  if (similar.completedInCategory > 0) {
    candidates.push({
      text: `${similar.completedInCategory} similar ${similar.completedInCategory === 1 ? 'project' : 'projects'} completed`,
      points: similar.points,
    })
  } else if (similar.portfolioInCategory > 0) {
    candidates.push({
      text: `${similar.portfolioInCategory} relevant portfolio ${similar.portfolioInCategory === 1 ? 'piece' : 'pieces'}`,
      points: similar.points * 0.6,
    })
  }
  if (rating.rating != null) {
    candidates.push({ text: `${rating.rating.toFixed(1)}★ rating`, points: rating.points })
  }
  if (budget.fits === true) {
    candidates.push({ text: 'Quote fits your budget', points: budget.points })
  } else if (budget.fits === 'close') {
    candidates.push({ text: 'Quote is close to your budget', points: budget.points })
  }
  if (timeline.fits === true) {
    candidates.push({ text: 'Delivery fits your timeline', points: timeline.points })
  }
  if (booster.pct >= 10) {
    candidates.push({ text: `Reliable — Profile Booster +${booster.pct}%`, points: booster.points })
  }

  candidates.sort((a, b) => b.points - a.points)
  return candidates.slice(0, 3).map((candidate) => candidate.text)
}

// Explainability — same signal shape buildReasons already uses. Exposed
// standalone per the service's suggested API, and used internally by
// evaluateResponse.
export function explainMatch(signals) {
  return buildReasons(signals)
}

// Core — evaluates ONE response (an offer + the provider who submitted it)
// against the ask it was submitted to. `price`/`deliveryDays` are read
// straight off the offer — this function doesn't fetch anything itself,
// see rankResponses for the data-loading wrapper.
export function evaluateResponse({ ask, provider, price, deliveryDays, reputation, completedInCategory, portfolioInCategory }) {
  const category = scoreCategory(ask, provider)
  const similar = scoreSimilarProjects({ completedInCategory, portfolioInCategory })
  const rating = scoreRating(reputation, provider)
  const budget = scoreBudget(ask, price)
  const timeline = scoreTimeline(ask, deliveryDays)
  const booster = scoreBooster(reputation)

  const rawScore =
    category.points + similar.points + rating.points + budget.points + timeline.points + booster.points
  const score = Math.round(Math.max(0, Math.min(100, rawScore)))

  return {
    score,
    label: getMatchLabel(score),
    reasons: explainMatch({ ask, category, similar, rating, budget, timeline, booster }),
    rating: rating.rating,
  }
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

// One concise, deterministic "why pick this one" summary per response —
// computed by comparing responses against EACH OTHER in this batch, not
// against the whole marketplace. Never AI-generated; just the response
// that's cheapest / fastest / best-reviewed / most experienced in this
// specific category among the ones actually being compared.
function assignStrengths(results) {
  if (results.length < 2) return results

  const lowestPrice = Math.min(...results.map((r) => r.offer.price))
  const fastestDelivery = Math.min(...results.map((r) => r.offer.deliveryDays))
  const highestRating = Math.max(...results.map((r) => r.rating ?? 0))
  const mostSimilarProjects = Math.max(...results.map((r) => r.similarProjectCount))

  return results.map((result) => {
    let strength = null
    if (result.offer.price === lowestPrice) strength = 'Best value'
    else if (result.offer.deliveryDays === fastestDelivery) strength = 'Fastest delivery'
    else if (result.rating != null && result.rating === highestRating && highestRating > 0) {
      strength = 'Highest rated'
    } else if (result.similarProjectCount === mostSimilarProjects && mostSimilarProjects > 0) {
      strength = 'Strongest portfolio fit'
    }
    return { ...result, strength }
  })
}

// The main matching screen's data source — Compare Responses passes in the
// ask, offers and providers it already loaded (this service never touches
// mocks directly); only the supplementary reputation/portfolio/completed-
// contract data is fetched here. Returns responses ranked by score, each
// with { offer, provider, score, label, reasons, strength }.
export async function rankResponses(ask, offers, providers) {
  const providerById = Array.isArray(providers)
    ? Object.fromEntries(providers.filter(Boolean).map((provider) => [provider.id, provider]))
    : providers

  const results = await Promise.all(
    offers.map(async (offer) => {
      const provider = providerById[offer.providerId]
      if (!provider) return null

      const [reputation, similarCounts] = await Promise.all([
        getProviderReputation(provider.id),
        getSimilarProjectCounts(provider.id, ask.category),
      ])

      const evaluation = evaluateResponse({
        ask,
        provider,
        price: offer.price,
        deliveryDays: offer.deliveryDays,
        reputation,
        completedInCategory: similarCounts.completedInCategory,
        portfolioInCategory: similarCounts.portfolioInCategory,
      })

      return {
        offer,
        provider,
        ...evaluation,
        similarProjectCount: similarCounts.completedInCategory + similarCounts.portfolioInCategory,
      }
    })
  )

  const valid = results.filter(Boolean).sort((a, b) => b.score - a.score)
  return assignStrengths(valid)
}

// Provider-side "Recommended for you" in Discover ASKs — deliberately kept
// lightweight and separate from the real ranking intelligence above: no
// offer exists yet, so budget/timeline can't be evaluated against a real
// quote. This is relevance discovery to help a provider find ASKs worth
// responding to, not a ranking of people who haven't responded.
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
