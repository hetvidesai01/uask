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
