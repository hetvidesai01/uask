import { contracts } from '../mocks/contracts'
import {
  PROGRESS_CHECKPOINTS,
  PROGRESS_LOCK_PERCENT,
  computeStageAmounts,
  getChangeKind,
  getEditPreview,
  getStage,
} from '../utils/contractMath'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

// Mock-only service. Contracts live in memory (like asks/offers); every
// mutating call returns a fresh copy so React state sees a new reference.
// Demo prototype: no escrow, no real payments, no real signatures — every
// "payment" is a status change. Role checks here mirror what a backend must
// enforce (seeker = "ASK Side", provider = "Respond Side").
//
// Persistence: the array is mirrored to localStorage so demo progress (signing,
// payments, edits) survives a reload. Bump the key version when the mock
// contract shape changes.
const STORAGE_KEY = 'uask.mock.contracts.v1'

try {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
  if (Array.isArray(stored) && stored.length > 0) contracts.splice(0, contracts.length, ...stored)
} catch {
  // Storage unavailable or corrupt — fall back to the seeded mocks.
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts))
  } catch {
    // Non-fatal: the demo just won't survive a reload.
  }
}

// Every read and mutation returns through here, so this is also where the
// current in-memory state is saved.
const snapshot = (contract) => {
  persist()
  return structuredClone(contract)
}

const DEMO_FEE_RATES = { clientPlatformFeePct: 2, freelancerCommissionPct: 8 }
const ACTION_DELAY = 250

const CHANGE_LABELS = {
  scope: 'scope',
  deadline: 'deadline',
  revisionsIncluded: 'included revisions',
  agreedPrice: 'agreed price',
  ownership: 'deliverable ownership',
  portfolioPermission: 'portfolio permission',
  confidentiality: 'confidentiality',
}

function findContract(contractId) {
  const contract = contracts.find((item) => item.id === contractId)
  if (!contract) throw new Error('Contract not found.')
  return contract
}

function roleOf(contract, userId) {
  if (contract.seekerId === userId) return 'seeker'
  if (contract.providerId === userId) return 'provider'
  throw new Error('Only the two parties on this contract can do that.')
}

function requireRole(contract, userId, expected, message) {
  if (roleOf(contract, userId) !== expected) throw new Error(message)
}

const actorLabel = (role) => (role === 'seeker' ? 'ASK Side' : 'Respond Side')

function log(contract, actor, action) {
  contract.history.push({
    id: `h-${contract.id}-${contract.history.length + 1}-${Date.now()}`,
    actor,
    action,
    at: new Date().toISOString(),
  })
}

function requireStatus(contract, allowed, message) {
  if (!allowed.includes(contract.status)) throw new Error(message)
}

export async function getContractsForUser(userId) {
  await delay()
  return contracts
    .filter((contract) => contract.seekerId === userId || contract.providerId === userId)
    .map(snapshot)
}

export async function getContractByAskId(askId) {
  await delay()
  const found = contracts.find((contract) => contract.askId === askId)
  return found ? snapshot(found) : null
}

function parseIncludedRevisions(deliverables) {
  for (const item of deliverables) {
    const match = /(\d+)\s*(?:revision|round)/i.exec(item)
    if (match) return Number(match[1])
  }
  return 2
}

function buildStages(contractId, price, createdAt, deadline) {
  const amounts = computeStageAmounts(price)
  const start = new Date(createdAt).getTime()
  const end = new Date(deadline).getTime()
  const span = Math.max(end - start, 0)
  const dues = [start, start + Math.round(span * 0.6), end]
  return [
    ['initial', 'Initial Payment', 25, 'Paid on contract confirmation.'],
    ['progress', 'Progress Payment', 50, 'Due at ~60% of the work, once approved by the ASK Side.'],
    ['final', 'Final Payment', 25, 'Due once the final work is submitted and approved.'],
  ].map(([stage, title, percent, description], index) => ({
    id: `milestone-${contractId}-${index + 1}`,
    stage,
    title,
    description,
    percent,
    amount: amounts[stage],
    dueDate: new Date(dues[index]).toISOString(),
    status: 'upcoming',
    paidAt: null,
  }))
}

// Mock-only contract creation, triggered when a seeker selects an offer
// (see Compare Responses' "Accept & Start"). Generates a contract DRAFT from
// the ASK + accepted response — it is not active until both parties sign.
export async function createContract({
  askId,
  offerId,
  seekerId,
  providerId,
  agreedPrice,
  currency,
  deliverables,
  deliveryDays,
  scope,
  revisionsIncluded,
}) {
  await delay()

  const existing = contracts.find((contract) => contract.askId === askId)
  if (existing) return snapshot(existing)

  const items = deliverables?.length > 0 ? deliverables : ['Project delivery']
  const now = Date.now()
  const createdAt = new Date(now).toISOString()
  const deadline = new Date(now + Math.max(deliveryDays || 7, 1) * 86400000).toISOString()
  const id = `contract-${contracts.length + 1}`

  const contract = {
    id,
    askId,
    offerId,
    seekerId,
    providerId,
    agreedPrice,
    currency,
    scope: scope?.trim() || items.join(', '),
    deliverables: items,
    deadline,
    revisionsIncluded: revisionsIncluded ?? parseIncludedRevisions(items),
    revisionsUsed: 0,
    status: 'draft',
    signatures: {
      seeker: { signed: false, signedAt: null },
      provider: { signed: false, signedAt: null },
    },
    progressPercent: 0,
    ownership: 'transfer_on_final_payment',
    portfolioPermission: 'ask_first',
    confidentiality: false,
    fees: { ...DEMO_FEE_RATES },
    editCount: 0,
    editFeesTotal: 0,
    pendingChange: null,
    cancellationRequest: null,
    dispute: null,
    previousStatus: null,
    rating: null,
    review: null,
    createdAt,
    completedAt: null,
    milestones: buildStages(id, agreedPrice, createdAt, deadline),
    history: [],
  }
  log(contract, 'System', 'Contract generated from ASK and accepted response')

  contracts.push(contract)
  return snapshot(contract)
}

// ── Signing ──────────────────────────────────────────────────────────────

export async function signContract(contractId, userId) {
  await delay(ACTION_DELAY)
  const contract = findContract(contractId)
  const role = roleOf(contract, userId)
  requireStatus(contract, ['draft', 'awaiting_signatures'], 'This contract can no longer be signed.')
  if (contract.pendingChange) throw new Error('Resolve the pending change before signing.')
  if (contract.signatures[role].signed) throw new Error('You have already signed.')

  contract.signatures[role] = { signed: true, signedAt: new Date().toISOString() }
  log(contract, actorLabel(role), 'Agreed & signed the contract (demo e-acceptance)')

  if (contract.signatures.seeker.signed && contract.signatures.provider.signed) {
    contract.status = 'active'
    log(contract, 'System', 'Both parties signed — contract active')
  } else {
    contract.status = 'awaiting_signatures'
  }
  return snapshot(contract)
}

// ── Editing / change proposals ───────────────────────────────────────────

export async function proposeContractChange(contractId, userId, { changes, note }) {
  await delay(ACTION_DELAY)
  const contract = findContract(contractId)
  const role = roleOf(contract, userId)
  requireStatus(
    contract,
    ['draft', 'awaiting_signatures', 'active', 'disputed'],
    'This contract can no longer be changed.'
  )
  if (contract.pendingChange) throw new Error('There is already a change waiting for a response.')

  const kind = getChangeKind(contract)
  if ((kind === 'amendment' || kind === 'dispute_correction') && !note?.trim()) {
    throw new Error('Add a short note explaining the amendment.')
  }

  const diff = {}
  for (const key of Object.keys(CHANGE_LABELS)) {
    if (!(key in changes)) continue
    const next = changes[key]
    const prev = contract[key]
    if (next === prev) continue
    diff[key] = next
  }
  if (Object.keys(diff).length === 0) throw new Error('No changes to propose.')

  if ('agreedPrice' in diff) {
    if (contract.milestones.some((m) => m.status === 'paid')) {
      throw new Error('The price cannot change after a payment is marked as paid.')
    }
    if (!(diff.agreedPrice > 0)) throw new Error('Enter a valid price.')
  }
  if ('revisionsIncluded' in diff && diff.revisionsIncluded < contract.revisionsUsed) {
    throw new Error('Included revisions cannot be lower than revisions already used.')
  }
  if ('deadline' in diff && Number.isNaN(new Date(diff.deadline).getTime())) {
    throw new Error('Enter a valid deadline.')
  }

  const { editNumber, fee } = getEditPreview(contract)
  contract.pendingChange = {
    id: `change-${Date.now()}`,
    kind,
    changes: diff,
    note: note?.trim() || null,
    proposedBy: role,
    proposedAt: new Date().toISOString(),
    editNumber: kind === 'edit' ? editNumber : null,
    fee: kind === 'edit' ? fee : 0,
  }
  const labels = Object.keys(diff).map((key) => CHANGE_LABELS[key])
  log(contract, actorLabel(role), `Proposed a change to ${labels.join(', ')}`)
  return snapshot(contract)
}

function applyChange(contract, pending) {
  const { changes } = pending
  Object.assign(contract, changes)

  if ('agreedPrice' in changes || 'deadline' in changes) {
    const amounts = computeStageAmounts(contract.agreedPrice)
    const start = new Date(contract.createdAt).getTime()
    const end = new Date(contract.deadline).getTime()
    const progressDue = start + Math.max(end - start, 0) * 0.6
    for (const stage of contract.milestones) {
      if (stage.status !== 'paid') stage.amount = amounts[stage.stage]
      if (stage.stage === 'progress') stage.dueDate = new Date(progressDue).toISOString()
      if (stage.stage === 'final') stage.dueDate = new Date(end).toISOString()
    }
  }

  if (pending.kind === 'edit') {
    contract.editCount += 1
    contract.editFeesTotal += pending.fee
  }
}

// decision: 'approve' | 'decline' (other party) or 'withdraw' (proposer)
export async function respondToChange(contractId, userId, decision) {
  await delay(ACTION_DELAY)
  const contract = findContract(contractId)
  const role = roleOf(contract, userId)
  const pending = contract.pendingChange
  if (!pending) throw new Error('There is no pending change.')

  if (decision === 'withdraw') {
    if (pending.proposedBy !== role) throw new Error('Only the proposer can withdraw this change.')
    contract.pendingChange = null
    log(contract, actorLabel(role), 'Withdrew the proposed change')
    return snapshot(contract)
  }

  if (pending.proposedBy === role) throw new Error('The other party needs to respond to this change.')

  if (decision === 'decline') {
    contract.pendingChange = null
    log(contract, actorLabel(role), 'Declined the proposed change')
    return snapshot(contract)
  }

  applyChange(contract, pending)
  contract.pendingChange = null
  const labels = Object.keys(pending.changes).map((key) => CHANGE_LABELS[key])
  const verb =
    pending.kind === 'amendment'
      ? 'Amendment approved'
      : pending.kind === 'dispute_correction'
        ? 'Dispute correction approved'
        : `Contract edit #${pending.editNumber} approved`
  log(contract, actorLabel(pending.proposedBy), `${verb}: changed ${labels.join(', ')}`)

  // Terms changed before work began: both parties must agree again.
  if (contract.status === 'draft' || contract.status === 'awaiting_signatures') {
    const hadSignature = contract.signatures.seeker.signed || contract.signatures.provider.signed
    contract.signatures = {
      seeker: { signed: false, signedAt: null },
      provider: { signed: false, signedAt: null },
    }
    contract.status = 'draft'
    if (hadSignature) log(contract, 'System', 'Terms changed — signatures reset')
  }
  return snapshot(contract)
}

// ── Progress & payment stages ────────────────────────────────────────────

export async function updateProgress(contractId, userId, percent) {
  await delay(ACTION_DELAY)
  const contract = findContract(contractId)
  requireRole(contract, userId, 'provider', 'Only the Respond Side can update project progress.')
  requireStatus(contract, ['active'], 'Progress can only be updated while the contract is active.')
  if (!PROGRESS_CHECKPOINTS.includes(percent)) throw new Error('Choose one of the progress checkpoints.')
  if (percent <= contract.progressPercent) throw new Error('Progress can only move forward.')

  const progressStage = getStage(contract, 'progress')
  if (percent > PROGRESS_LOCK_PERCENT && progressStage.status !== 'approved' && progressStage.status !== 'paid') {
    throw new Error('The ASK Side must approve the 60% progress milestone before work continues past it.')
  }

  contract.progressPercent = percent
  if (percent >= PROGRESS_LOCK_PERCENT && progressStage.status === 'upcoming') {
    progressStage.status = 'in_progress'
  }
  log(contract, 'Respond Side', `Updated project progress to ${percent}%`)
  return snapshot(contract)
}

export async function submitStage(contractId, userId, stageKey) {
  await delay(ACTION_DELAY)
  const contract = findContract(contractId)
  requireRole(contract, userId, 'provider', 'Only the Respond Side can submit work.')
  requireStatus(contract, ['active'], 'Work can only be submitted while the contract is active.')

  const stage = getStage(contract, stageKey)
  if (!stage || stageKey === 'initial') throw new Error('That payment stage is not submitted for approval.')
  if (stage.status !== 'upcoming' && stage.status !== 'in_progress') throw new Error('Already submitted.')

  if (stageKey === 'progress') {
    if (contract.progressPercent < PROGRESS_LOCK_PERCENT) {
      throw new Error('Update progress to 60% before submitting the progress milestone.')
    }
  } else {
    if (getStage(contract, 'progress').status !== 'paid') {
      throw new Error('The Progress Payment must be marked as paid before final submission.')
    }
    if (contract.progressPercent < 100) throw new Error('Update progress to 100% before final submission.')
  }

  stage.status = 'submitted'
  log(
    contract,
    'Respond Side',
    stageKey === 'progress' ? 'Submitted the 60% progress milestone' : 'Submitted the final work'
  )
  return snapshot(contract)
}

// decision: 'approve' | 'revision'
export async function reviewStage(contractId, userId, stageKey, decision) {
  await delay(ACTION_DELAY)
  const contract = findContract(contractId)
  requireRole(contract, userId, 'seeker', 'Only the ASK Side can review submitted work.')
  requireStatus(contract, ['active'], 'Work can only be reviewed while the contract is active.')

  const stage = getStage(contract, stageKey)
  if (!stage || stage.status !== 'submitted') throw new Error('Nothing is waiting for approval.')
  const what = stageKey === 'progress' ? 'progress milestone' : 'final work'

  if (decision === 'approve') {
    stage.status = 'approved'
    log(contract, 'ASK Side', `Approved the ${what}`)
  } else {
    if (contract.revisionsUsed >= contract.revisionsIncluded) {
      throw new Error('All included revisions are used. Additional work may require a contract change.')
    }
    contract.revisionsUsed += 1
    stage.status = 'in_progress'
    log(
      contract,
      'ASK Side',
      `Requested a revision on the ${what} (${contract.revisionsUsed} of ${contract.revisionsIncluded} used)`
    )
  }
  return snapshot(contract)
}

// Marks a stage as paid in the demo. Completing the final stage completes
// the contract. No money moves.
export async function markStagePaid(contractId, userId, stageKey) {
  await delay(ACTION_DELAY)
  const contract = findContract(contractId)
  requireRole(contract, userId, 'seeker', 'Only the ASK Side can mark a payment as paid.')
  requireStatus(contract, ['active'], 'Payments can only be marked as paid while the contract is active.')

  const stage = getStage(contract, stageKey)
  if (!stage || stage.status === 'paid') throw new Error('Nothing to mark as paid.')
  const payable = stageKey === 'initial' ? stage.status === 'upcoming' : stage.status === 'approved'
  if (!payable) throw new Error('This payment is not due yet.')

  const now = new Date().toISOString()
  stage.status = 'paid'
  stage.paidAt = now
  log(contract, 'ASK Side', `Marked ${stage.title} as paid (demo)`)

  if (stageKey === 'final') {
    contract.status = 'completed'
    contract.completedAt = now
    log(contract, 'System', 'Contract completed')
  }
  return snapshot(contract)
}

// ── Cancellation & disputes ──────────────────────────────────────────────

export async function requestCancellation(contractId, userId) {
  await delay(ACTION_DELAY)
  const contract = findContract(contractId)
  const role = roleOf(contract, userId)
  requireStatus(contract, ['draft', 'awaiting_signatures', 'active'], 'This contract cannot be cancelled now.')
  if (contract.cancellationRequest) throw new Error('A cancellation request is already open.')

  contract.cancellationRequest = { by: role, at: new Date().toISOString() }
  log(contract, actorLabel(role), 'Requested cancellation')
  return snapshot(contract)
}

// decision: 'accept' | 'decline' (other party) or 'withdraw' (requester)
export async function respondToCancellation(contractId, userId, decision) {
  await delay(ACTION_DELAY)
  const contract = findContract(contractId)
  const role = roleOf(contract, userId)
  const request = contract.cancellationRequest
  if (!request) throw new Error('There is no cancellation request.')

  if (decision === 'withdraw') {
    if (request.by !== role) throw new Error('Only the requester can withdraw this.')
    contract.cancellationRequest = null
    log(contract, actorLabel(role), 'Withdrew the cancellation request')
  } else {
    if (request.by === role) throw new Error('The other party needs to respond to this request.')
    contract.cancellationRequest = null
    if (decision === 'accept') {
      contract.status = 'cancelled'
      contract.pendingChange = null
      log(contract, actorLabel(role), 'Accepted the cancellation request — contract cancelled')
    } else {
      log(contract, actorLabel(role), 'Declined the cancellation request')
    }
  }
  return snapshot(contract)
}

export async function raiseDispute(contractId, userId, { reason, description }) {
  await delay(ACTION_DELAY)
  const contract = findContract(contractId)
  const role = roleOf(contract, userId)
  requireStatus(contract, ['active'], 'A dispute can only be raised on an active contract.')
  if (!reason) throw new Error('Select a reason for the dispute.')

  contract.previousStatus = contract.status
  contract.status = 'disputed'
  contract.dispute = {
    reason,
    description: description?.trim() || null,
    raisedBy: role,
    raisedAt: new Date().toISOString(),
  }
  log(contract, actorLabel(role), `Raised a dispute: ${reason}`)
  return snapshot(contract)
}

export async function withdrawDispute(contractId, userId) {
  await delay(ACTION_DELAY)
  const contract = findContract(contractId)
  const role = roleOf(contract, userId)
  requireStatus(contract, ['disputed'], 'This contract is not in dispute.')
  if (contract.dispute?.raisedBy !== role) throw new Error('Only the party who raised the dispute can withdraw it.')

  contract.status = contract.previousStatus ?? 'active'
  contract.previousStatus = null
  contract.dispute = null
  contract.pendingChange = null
  log(contract, actorLabel(role), 'Withdrew the dispute')
  return snapshot(contract)
}

// ── Low-level helpers (kept for API compatibility) ───────────────────────

export async function updateMilestoneStatus(contractId, milestoneId, status) {
  await delay(150)

  const contract = contracts.find((item) => item.id === contractId)
  if (!contract) return null

  const milestone = contract.milestones.find((item) => item.id === milestoneId)
  if (!milestone) return null

  milestone.status = status
  return snapshot(contract)
}

export async function markContractCompleted(contractId) {
  await delay(150)

  const contract = contracts.find((item) => item.id === contractId)
  if (!contract) return null

  contract.status = 'completed'
  contract.completedAt = new Date().toISOString()
  return snapshot(contract)
}

export async function rateContract(contractId, { rating, review }) {
  await delay()

  const contract = contracts.find((item) => item.id === contractId)
  if (!contract) return null

  contract.rating = rating
  contract.review = review || null
  log(contract, 'ASK Side', `Rated the project ${Number(rating).toFixed(1)} / 5`)
  return snapshot(contract)
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
    .map(snapshot)
}
