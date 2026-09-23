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
