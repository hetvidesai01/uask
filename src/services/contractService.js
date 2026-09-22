import { contracts } from '../mocks/contracts'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getContractsForUser(userId) {
  await delay()
  return contracts.filter((contract) => contract.seekerId === userId || contract.providerId === userId)
}
