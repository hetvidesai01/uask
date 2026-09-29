import { contracts } from '../mocks/contracts'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getContractsForUser(userId) {
  await delay()
  return contracts.filter((contract) => contract.seekerId === userId || contract.providerId === userId)
}

export async function getContractByAskId(askId) {
  await delay()
  return contracts.find((contract) => contract.askId === askId) ?? null
}

// Mock-only contract creation, triggered when a seeker accepts an offer
// (see Compare Responses' "Accept & Start"). Builds a simple milestone
// breakdown from the accepted offer's own deliverables so the Contract
// page is never blank right after acceptance — no real scheduling engine,
// mirrors the same in-memory-only pattern askService/offerService already
// use for created records (not localStorage-persisted).
export async function createContract({ askId, offerId, seekerId, providerId, agreedPrice, currency, deliverables, deliveryDays }) {
  await delay()

  const existing = contracts.find((contract) => contract.askId === askId)
  if (existing) return existing

  const items = deliverables?.length > 0 ? deliverables : ['Project delivery']
  const milestoneCount = Math.min(items.length, 3)
  const groups = Array.from({ length: milestoneCount }, (_, index) =>
    items.filter((_, itemIndex) => itemIndex % milestoneCount === index)
  )

  const baseAmount = Math.floor(agreedPrice / milestoneCount)
  const remainder = agreedPrice - baseAmount * milestoneCount
  const totalDays = Math.max(deliveryDays || milestoneCount * 3, milestoneCount)
  const now = Date.now()

  const milestones = groups.map((group, index) => {
    const dueOffsetDays = Math.round(((index + 1) / milestoneCount) * totalDays)
    return {
      id: `milestone-${askId}-${index + 1}`,
      title: group[0] ?? `Milestone ${index + 1}`,
      description: group.join(', '),
      amount: index === milestoneCount - 1 ? baseAmount + remainder : baseAmount,
      dueDate: new Date(now + dueOffsetDays * 86400000).toISOString(),
      status: 'upcoming',
    }
  })

  const contract = {
    id: `contract-${contracts.length + 1}`,
    askId,
    offerId,
    seekerId,
    providerId,
    agreedPrice,
    currency,
    deliverables: items,
    status: 'active',
    rating: null,
    review: null,
    createdAt: new Date(now).toISOString(),
    completedAt: null,
    milestones,
  }

  contracts.push(contract)
  return contract
}

export async function updateMilestoneStatus(contractId, milestoneId, status) {
  await delay(150)

  const contract = contracts.find((item) => item.id === contractId)
  if (!contract) return null

  const milestone = contract.milestones.find((item) => item.id === milestoneId)
  if (!milestone) return null

  milestone.status = status
  return contract
}

export async function markContractCompleted(contractId) {
  await delay(150)

  const contract = contracts.find((item) => item.id === contractId)
  if (!contract) return null

  contract.status = 'completed'
  contract.completedAt = new Date().toISOString()
  return contract
}

export async function rateContract(contractId, { rating, review }) {
  await delay()

  const contract = contracts.find((item) => item.id === contractId)
  if (!contract) return null

  contract.rating = rating
  contract.review = review || null
  return contract
}

// 'paid' is the only terminal milestone status — see mocks/contracts.js.
function isSettled(milestoneStatus) {
  return milestoneStatus === 'paid'
}

// Aggregate reputation numbers for a provider, built from the same simple
// milestone math already used on the Payments dashboard and the Contract
// page (Profile Booster = completed/total milestones scaled to a modest
// percentage, not a real ranking algorithm). Average rating and review
// count fall back to `null`/`0` when the provider has no rated completed
// contracts yet — the page decides whether to blend that with the user's
// seeded baseline reputation, this service only reports what the contract
// data itself shows.
export async function getProviderReputation(userId) {
  await delay()

  const providerContracts = contracts.filter(
    (contract) => contract.providerId === userId && (contract.status === 'active' || contract.status === 'completed')
  )

  const revenue = providerContracts.reduce(
    (sum, contract) =>
      sum + contract.milestones.filter((m) => isSettled(m.status)).reduce((s, m) => s + m.amount, 0),
    0
  )

  const completedContracts = providerContracts.filter((contract) => contract.status === 'completed')
  const ratedCompletedContracts = completedContracts.filter((contract) => contract.rating != null)
  const averageRating = ratedCompletedContracts.length
    ? ratedCompletedContracts.reduce((sum, contract) => sum + contract.rating, 0) / ratedCompletedContracts.length
    : null

  const completedMilestoneCount = providerContracts.reduce(
    (count, contract) => count + contract.milestones.filter((m) => isSettled(m.status)).length,
    0
  )
  const totalMilestoneCount = providerContracts.reduce(
    (count, contract) => count + contract.milestones.length,
    0
  )
  const profileBoosterPct = totalMilestoneCount
    ? Math.round((completedMilestoneCount / totalMilestoneCount) * 20)
    : 0

  return {
    revenue,
    averageRating,
    reviewCount: ratedCompletedContracts.length,
    completedContractCount: completedContracts.length,
    completedMilestoneCount,
    totalMilestoneCount,
    profileBoosterPct,
  }
}

// Raw completed contracts for a provider, most recently completed first —
// the page joins these with ask/user data for the Completed Work and
// Reviews sections (reviews are just the subset with a non-null rating).
export async function getCompletedContractsForProvider(userId) {
  await delay()

  return contracts
    .filter((contract) => contract.providerId === userId && contract.status === 'completed')
    .slice()
    .sort((a, b) => new Date(b.completedAt ?? b.createdAt) - new Date(a.completedAt ?? a.createdAt))
}
