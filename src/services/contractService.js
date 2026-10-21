import { contracts } from '../mocks/contracts'
import { http } from './http'
import { isBackendId } from './userService'
import { getChangeKind, getEditPreview } from '../utils/contractMath'

// Contract service — backend adapter for the Contract page and the
// dashboard/inbox contract lists (Phase 6).
//
// Everything the UI sees is shaped here: backend camelCase contract rows are
// mapped into the page's model — nested `signatures`, `progressPercent`,
// `deadline`, ownership/portfolio value renames, the page's workflow stage
// vocabulary (upcoming/in_progress/submitted/approved/paid), history
// sentences, and the pendingChange / dispute / cancellation notices.
// Components never see backend shapes.
//
// Two read depths:
//   - shallow (list) for dashboards/inbox: GET /contracts only;
//   - deep for the single-contract page: the contract plus its amendments,
//     disputes and history loaded in parallel, since the page renders the
//     pending-change card, dispute/cancellation notices and history inline.
//
// Demo-prototype semantics come from the backend and are never claimed
// otherwise: `paid` is a demo label (no escrow, no gateway, no money moves),
// edit fees are informational only, and all role/state gates are enforced
// server-side — the `userId`/`actorId` arguments the page passes are ignored
// (the signer/actor is always the authenticated user; the demo "act as"
// switch can therefore surface backend 403 messages when acting as the other
// side, and the UI copy is preserved as-is).
//
// TEMPORARY: `mocks/contracts` still backs getProviderReputation /
// getCompletedContractsForProvider for seeded (non-UUID) demo people. The
// contract workflow itself is backend-only: non-UUID ask ids resolve to
// `null` (the page's existing "No contract yet" state).

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

// History is served oldest-first with a 100-row page size; the deep read
// walks every page (capped) so long contracts still show their full trail.
const MAX_HISTORY_PAGES = 10

// The cancellation modal has no reason field (unchanged UI) but the backend
// requires one — this adapter-synthesized note is what gets recorded.
const CANCELLATION_REASON = 'Cancellation requested from the contract page.'

// ── Backend → page value maps ────────────────────────────────────────────

const STAGE_PERCENT = { initial: 25, progress: 50, final: 25 }
// Backend titles carry the percent ("Initial payment (25%)"); the page adds
// the percent itself, so the adapter supplies the bare mock-era titles.
const STAGE_TITLE = {
  initial: 'Initial Payment',
  progress: 'Progress Payment',
  final: 'Final Payment',
}

const OWNERSHIP_TO_PAGE = {
  transfers_after_final_payment: 'transfer_on_final_payment',
  custom: 'custom',
}
const OWNERSHIP_TO_BACKEND = {
  transfer_on_final_payment: 'transfers_after_final_payment',
  custom: 'custom',
}
const PORTFOLIO_TO_PAGE = {
  allowed: 'allowed',
  not_allowed: 'not_allowed',
  ask_before_using: 'ask_first',
}
const PORTFOLIO_TO_BACKEND = {
  allowed: 'allowed',
  not_allowed: 'not_allowed',
  ask_first: 'ask_before_using',
}

// Dispute reasons: the page's select holds human labels, the backend enum is
// snake_case — mapped in both directions, never displayed raw.
const DISPUTE_REASON_TO_LABEL = {
  scope_mismatch: 'Work differs from agreed scope',
  missed_deadline: 'Missed deadline',
  communication_issue: 'Communication issue',
  payment_disagreement: 'Payment disagreement',
  revision_disagreement: 'Revision disagreement',
  other: 'Other',
}
const DISPUTE_REASON_TO_BACKEND = Object.fromEntries(
  Object.entries(DISPUTE_REASON_TO_LABEL).map(([code, label]) => [label, code]),
)

const AMEND_FIELD_LABELS = {
  scope: 'scope',
  deliverables: 'deliverables',
  finalDeadline: 'deadline',
  includedRevisionCount: 'included revisions',
  ownershipOption: 'deliverable ownership',
  portfolioPermission: 'portfolio permission',
  confidentialityAgreed: 'confidentiality',
}

// Page change keys → backend amendable fields (see API_CONTRACT.md §9).
// Price/currency are NOT amendable on the backend — agreedPrice is rejected
// with a clear message in proposeContractChange before any request.
const PAGE_CHANGES_TO_BACKEND = {
  scope: { key: 'scope' },
  deadline: { key: 'finalDeadline', map: (value) => String(value).slice(0, 10) },
  revisionsIncluded: { key: 'includedRevisionCount' },
  ownership: { key: 'ownershipOption', map: (value) => OWNERSHIP_TO_BACKEND[value] ?? value },
  portfolioPermission: {
    key: 'portfolioPermission',
    map: (value) => PORTFOLIO_TO_BACKEND[value] ?? value,
  },
  confidentiality: { key: 'confidentialityAgreed' },
}

// ── Row → page model ─────────────────────────────────────────────────────

// Backend stage statuses (not_due/due/awaiting_approval/paid/disputed) are
// translated into the page's internal workflow vocabulary so
// getStageDisplayStatus and the action gating keep working unchanged:
//   not_due → upcoming, due → upcoming (initial) / approved (progress+final,
//   i.e. payable), awaiting_approval → submitted, paid → paid.
// `disputed` maps to upcoming because the stage badge is overridden at
// contract level whenever contract.status === 'disputed'.
function toWorkflowStatus(status, kind) {
  if (status === 'paid') return 'paid'
  if (status === 'awaiting_approval') return 'submitted'
  if (status === 'due') return kind === 'initial' ? 'upcoming' : 'approved'
  return 'upcoming'
}

const toIsoDate = (value) => (value ? (/T/.test(value) ? value : `${value}T00:00:00.000Z`) : null)

// Display-only fee rate derived from the backend's authoritative amounts —
// a 0 platformFee shows as a 0% demo rate; percentages are never invented.
const ratePct = (amount, total) => (total > 0 ? Math.round(((amount ?? 0) / total) * 1000) / 10 : 0)

function mapMilestone(milestone) {
  const kind = milestone.kind
  return {
    id: milestone.id,
    stage: kind,
    title: STAGE_TITLE[kind] ?? milestone.title,
    description: milestone.description ?? null,
    percent: STAGE_PERCENT[kind] ?? 0,
    amount: milestone.amount,
    dueDate: toIsoDate(milestone.dueDate),
    status: toWorkflowStatus(milestone.status, kind),
    paidAt: milestone.paidAt ?? null,
  }
}

// Backend history {actorId, action, details, createdAt} → the page's
// {actor, action, at} rows with the existing mock-era sentences, so the
// history list reads exactly as before.
function describeHistoryAction(entry) {
  const details = entry.details ?? {}
  switch (entry.action) {
    case 'contract_generated':
      return 'Contract generated from ASK and accepted response'
    case 'contract_signed':
      return 'Agreed & signed the contract (demo e-acceptance)'
    case 'contract_activated':
      return 'Both parties signed — contract active'
    case 'payment_stage_changed':
      return `Marked ${STAGE_TITLE[details.stage] ?? 'a payment stage'} as paid (demo)`
    case 'progress_submitted':
      return details.progress === 60 ? 'Submitted the 60% progress milestone' : 'Submitted the final work'
    case 'progress_approved':
      return details.progress === 60 ? 'Approved the progress milestone' : 'Approved the final work'
    case 'revision_requested': {
      const what = details.stage === 'progress' ? 'progress milestone' : 'final work'
      return `Requested a revision on the ${what} (${details.revisionsUsed} of ${details.includedRevisionCount} used)`
    }
    case 'terms_amended': {
      if (details.phase === 'rejected') return 'Declined the proposed change'
      if (details.phase === 'withdrawn') return 'Withdrew the proposed change'
      if (details.phase === 'applied') {
        const labels = (details.fields ?? []).map((field) => AMEND_FIELD_LABELS[field] ?? field)
        return labels.length ? `Contract change approved: changed ${labels.join(', ')}` : 'Contract change approved'
      }
      return 'Proposed a contract change'
    }
    case 'signatures_reset':
      return 'Terms changed — signatures reset'
    case 'dispute_raised':
      return `Raised a dispute: ${DISPUTE_REASON_TO_LABEL[details.reason] ?? details.reason ?? 'dispute'}`
    case 'dispute_resolved':
      return 'Withdrew the dispute'
    case 'cancellation_requested':
      return 'Requested cancellation'
    case 'cancellation_approved':
      return 'Accepted the cancellation request — contract cancelled'
    case 'cancellation_declined':
      return 'Declined the cancellation request'
    case 'cancellation_withdrawn':
      return 'Withdrew the cancellation request'
    case 'contract_completed':
      return 'Contract completed'
    default:
      return entry.action ? String(entry.action).replace(/_/g, ' ') : 'Contract updated'
  }
}

function mapHistoryEntry(entry, row) {
  const actor =
    entry.actorId == null
      ? 'System'
      : entry.actorId === row.seekerId
        ? 'ASK Side'
        : entry.actorId === row.providerId
          ? 'Respond Side'
          : 'System'
  return {
    id: entry.id,
    actor,
    action: describeHistoryAction(entry),
    at: entry.createdAt,
  }
}

// Backend amendment changes (backend field names) → the page's change keys.
function toPageChanges(changes) {
  const mapped = {}
  for (const [key, value] of Object.entries(changes)) {
    if (key === 'ownershipOption') mapped.ownership = OWNERSHIP_TO_PAGE[value] ?? value
    else if (key === 'finalDeadline') mapped.deadline = value
    else if (key === 'includedRevisionCount') mapped.revisionsIncluded = value
    else if (key === 'portfolioPermission') mapped.portfolioPermission = PORTFOLIO_TO_PAGE[value] ?? value
    else if (key === 'confidentialityAgreed') mapped.confidentiality = value
    else mapped[key] = value // e.g. deliverables — rendered by the default row
  }
  return mapped
}

function buildPendingChange(contract, amendment) {
  const kind = getChangeKind(contract)
  const isEdit = kind === 'edit'
  const preview = isEdit ? getEditPreview(contract) : null
  return {
    id: amendment.id,
    kind,
    changes: toPageChanges(amendment.changes ?? {}),
    note: amendment.reason ?? null,
    proposedBy: amendment.proposedBy === contract.seekerId ? 'seeker' : 'provider',
    proposedAt: amendment.createdAt,
    editNumber: isEdit ? amendment.editNumber : null,
    fee: preview ? preview.fee : 0,
  }
}

// The backend serializes the requester only implicitly (no cancellation
// "by" field) — the pending request's actor is read from the history trail.
function cancellationRequestBy(history, row) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].action === 'cancellation_requested') {
      if (history[i].actorId == null) return null
      return history[i].actorId === row.seekerId ? 'seeker' : 'provider'
    }
  }
  return null
}

function mapContractRow(row, subs = {}) {
  const rawHistory = subs.history ?? []
  const pending = (subs.amendments ?? []).find((item) => item.status === 'pending') ?? null
  const openDispute = (subs.disputes ?? []).find((item) => item.status === 'open') ?? null

  const contract = {
    id: row.id,
    askId: row.askId,
    offerId: row.offerId,
    seekerId: row.seekerId,
    providerId: row.providerId,
    agreedPrice: row.agreedPrice,
    currency: row.currency,
    scope: row.scope ?? '',
    deliverables: row.deliverables ?? [],
    deadline: toIsoDate(row.finalDeadline),
    revisionsIncluded: row.includedRevisionCount,
    revisionsUsed: row.revisionsUsed,
    status: row.status,
    signatures: {
      seeker: { signed: Boolean(row.askSideSignedAt), signedAt: row.askSideSignedAt ?? null },
      provider: { signed: Boolean(row.respondSideSignedAt), signedAt: row.respondSideSignedAt ?? null },
    },
    progressPercent: row.projectProgress,
    ownership: OWNERSHIP_TO_PAGE[row.ownershipOption] ?? 'transfer_on_final_payment',
    portfolioPermission: PORTFOLIO_TO_PAGE[row.portfolioPermission] ?? 'ask_first',
    confidentiality: Boolean(row.confidentialityAgreed),
    fees: {
      clientPlatformFeePct: ratePct(row.platformFee, row.projectValue),
      freelancerCommissionPct: ratePct(row.providerCommission, row.projectValue),
    },
    editCount: row.contractEditCount,
    editFeesTotal: row.calculatedEditFee,
    pendingChange: null,
    // Deep reads fill the requester from history; list reads (dashboards)
    // never render the notice, so `by` may be null on the shallow map.
    cancellationRequest: row.cancellationRequested
      ? {
          by: cancellationRequestBy(rawHistory, row),
          at: row.cancellationRequestedAt ?? null,
          reason: row.cancellationReason ?? null,
          estimatePct: row.cancellationTerminationEstimatePct ?? null,
        }
      : null,
    dispute: openDispute
      ? {
          id: openDispute.id,
          reason: DISPUTE_REASON_TO_LABEL[openDispute.reason] ?? openDispute.reason,
          description: openDispute.description ?? null,
          raisedBy: openDispute.raisedBy === row.seekerId ? 'seeker' : 'provider',
          raisedAt: openDispute.createdAt,
        }
      : null,
    previousStatus: null,
    rating: row.rating ?? null,
    review: row.review ?? null,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? null,
    milestones: (row.milestones ?? []).map(mapMilestone),
    history: rawHistory.map((entry) => mapHistoryEntry(entry, row)),
  }

  if (pending) contract.pendingChange = buildPendingChange(contract, pending)
  return contract
}

// ── Deep reads ───────────────────────────────────────────────────────────

async function fetchAllHistory(contractId) {
  const entries = []
  for (let page = 1; page <= MAX_HISTORY_PAGES; page += 1) {
    const result = await http.get(`/contracts/${contractId}/history?page=${page}&pageSize=100`)
    entries.push(...(result?.items ?? []))
    if (!result?.hasNext) break
  }
  return entries
}

// Contract row + amendments + disputes + history in parallel → full page
// model. Every mutating action returns through here, so the page always
// swaps in complete, freshly derived state.
async function loadContractDeep(row) {
  const [amendments, disputes, history] = await Promise.all([
    http.get(`/contracts/${row.id}/amendments?pageSize=100`),
    http.get(`/contracts/${row.id}/disputes?pageSize=100`),
    fetchAllHistory(row.id),
  ])
  return mapContractRow(row, {
    amendments: amendments?.items ?? [],
    disputes: disputes?.items ?? [],
    history,
  })
}

async function refetchContract(contractId) {
  return loadContractDeep(await http.get(`/contracts/${contractId}`))
}

async function fetchPendingAmendment(contractId) {
  const result = await http.get(`/contracts/${contractId}/amendments?pageSize=100`)
  const pending = (result?.items ?? []).find((item) => item.status === 'pending')
  if (!pending) throw new Error('There is no pending change.')
  return pending
}

// ── Reads ────────────────────────────────────────────────────────────────

// `userId` is ignored — the backend scopes the list to the authenticated
// user (either side), newest first. Shallow map: dashboards/inbox only need
// status/price/milestones/links.
export async function getContractsForUser(_userId) {
  const result = await http.get('/contracts?pageSize=100')
  return (result?.items ?? []).map((row) => mapContractRow(row))
}

// Deep read for the Contract page. Expected absence — no contract yet, or a
// viewer who is not a participant (403) — resolves to `null` (the page's
// existing "No contract yet" state); other failures propagate. Seeded
// (non-UUID) ask ids skip the request entirely.
export async function getContractByAskId(askId) {
  if (!isBackendId(askId)) return null
  let row
  try {
    row = await http.get(`/asks/${askId}/contract`)
  } catch (error) {
    if (error?.status === 404 || error?.status === 403) return null
    throw error
  }
  return loadContractDeep(row)
}

// ── Signing ──────────────────────────────────────────────────────────────

// POST /contracts/{id}/sign — the signer is the authenticated user; each
// side signs only itself, idempotently (the mock's "already signed" error
// can no longer occur — the page hides the button once signed anyway).
export async function signContract(contractId, _userId) {
  const row = await http.post(`/contracts/${contractId}/sign`)
  return loadContractDeep(row)
}

// ── Editing / change proposals ───────────────────────────────────────────

export async function proposeContractChange(contractId, _userId, { changes, note }) {
  // Backend contract: price/currency are frozen for the life of the
  // contract (422 on any proposal containing them). Surface that clearly
  // instead of a generic validation toast.
  if (changes && 'agreedPrice' in changes) {
    throw new Error('The agreed price cannot be changed on this contract.')
  }

  const mapped = {}
  for (const [key, value] of Object.entries(changes ?? {})) {
    const rule = PAGE_CHANGES_TO_BACKEND[key]
    if (!rule) continue
    mapped[rule.key] = rule.map ? rule.map(value) : value
  }

  await http.post(`/contracts/${contractId}/amendments`, {
    changes: mapped,
    ...(note?.trim() ? { reason: note.trim() } : {}),
  })
  // The proposal response is an amendment row — refetch the contract.
  return refetchContract(contractId)
}

// decision: 'approve' | 'decline' (other party) or 'withdraw' (proposer).
// Backend keeps the amendment id server-side; the pending one is looked up
// here rather than trusted from page state. Pre-signing approvals reset both
// signatures server-side — the refetch shows the contract back in draft.
export async function respondToChange(contractId, _userId, decision) {
  const pending = await fetchPendingAmendment(contractId)
  const action = decision === 'approve' ? 'approve' : decision === 'decline' ? 'reject' : 'withdraw'
  await http.post(`/contracts/${contractId}/amendments/${pending.id}/${action}`)
  return refetchContract(contractId)
}

// ── Progress & payment stages ────────────────────────────────────────────

// `projectProgress` is derived server-side from workflow events only; the
// backend accepts 60/100 submissions and stamps 25 itself when the Initial
// Payment is marked paid. The 25% checkpoint button therefore reports why it
// cannot be set by hand instead of sending an impossible request.
export async function updateProgress(contractId, _userId, percent) {
  if (percent === 25) {
    throw new Error('The Initial Payment sets 25% progress automatically — it cannot be set by hand.')
  }
  if (percent !== 60 && percent !== 100) {
    throw new Error('Choose one of the progress checkpoints.')
  }
  const row = await http.post(`/contracts/${contractId}/progress`, { progress: percent })
  return loadContractDeep(row)
}

// Kept for API compatibility with the page: submitting a stage IS the
// progress submission on the backend (60 → progress stage, 100 → final).
// Normally unreachable (the progress button already submits), but wired to
// the same endpoint so a revision round's re-submission works if called.
export async function submitStage(contractId, _userId, stageKey) {
  if (stageKey === 'initial') throw new Error('That payment stage is not submitted for approval.')
  const row = await http.post(`/contracts/${contractId}/progress`, {
    progress: stageKey === 'progress' ? 60 : 100,
  })
  return loadContractDeep(row)
}

// decision: 'approve' | 'revision' — reviewed stage is whichever submission
// is awaiting review server-side (the page only shows the review box for it).
export async function reviewStage(contractId, _userId, _stageKey, decision) {
  const action = decision === 'approve' ? 'approve' : 'revision'
  const row = await http.post(`/contracts/${contractId}/progress/${action}`)
  return loadContractDeep(row)
}

// ASK side only, only from `due` — all enforced by the backend (403/409s
// surface as toasts). `paid` is a demo label; nothing moves money.
export async function markStagePaid(contractId, _userId, stageKey) {
  const current = await http.get(`/contracts/${contractId}`)
  const milestone = (current?.milestones ?? []).find((item) => item.kind === stageKey)
  if (!milestone) throw new Error('Nothing to mark as paid.')

  let row = await http.patch(`/contracts/${contractId}/milestones/${milestone.id}`, { status: 'paid' })
  if (stageKey === 'final') {
    // Preserve the page's single-action completion: paying the final stage
    // completes the contract, exactly as the old flow did. The backend
    // still validates (seeker-only, active + final paid); if completion is
    // not possible the paid contract is shown as-is.
    try {
      row = await http.post(`/contracts/${contractId}/complete`)
    } catch {
      // Keep the paid-but-not-completed contract; the page shows its status.
    }
  }
  return loadContractDeep(row)
}

// ── Cancellation & disputes ──────────────────────────────────────────────

export async function requestCancellation(contractId, _userId) {
  const row = await http.post(`/contracts/${contractId}/cancellation-request`, {
    reason: CANCELLATION_REASON,
  })
  return loadContractDeep(row)
}

// decision: 'accept' | 'decline' (other party) or 'withdraw' (requester) —
// 'accept' maps to the backend's 'approve' decision.
export async function respondToCancellation(contractId, _userId, decision) {
  const mapped = decision === 'accept' ? 'approve' : decision
  const row = await http.post(`/contracts/${contractId}/cancellation-request/respond`, {
    decision: mapped,
  })
  return loadContractDeep(row)
}

export async function raiseDispute(contractId, _userId, { reason, description }) {
  const code = reason ? DISPUTE_REASON_TO_BACKEND[reason] : null
  if (!code) throw new Error('Select a reason for the dispute.')
  const row = await http.post(`/contracts/${contractId}/disputes`, {
    reason: code,
    ...(description?.trim() ? { description: description.trim() } : {}),
  })
  return loadContractDeep(row)
}

// The backend has no separate "withdraw dispute" — closing it goes through
// the resolve endpoint (participants only; the UI keeps its raiser-only
// withdraw button and copy). When no dispute remains open the contract
// returns to active server-side.
export async function withdrawDispute(contractId, _userId) {
  const result = await http.get(`/contracts/${contractId}/disputes?pageSize=100`)
  const open = (result?.items ?? []).find((item) => item.status === 'open')
  if (!open) throw new Error('This contract is not in dispute.')
  await http.post(`/contracts/${contractId}/disputes/${open.id}/resolve`)
  return refetchContract(contractId)
}

// ── Rating ───────────────────────────────────────────────────────────────

// Seeker only, completed contract only, set once — backend-enforced; the
// response is the contract row, so deep state comes straight back.
export async function rateContract(contractId, { rating, review }) {
  const row = await http.post(`/contracts/${contractId}/rating`, {
    rating,
    ...(review ? { review } : {}),
  })
  return loadContractDeep(row)
}

// ── Reputation + completed history (Phase 2, unchanged) ──────────────────

// 'paid' is the only terminal milestone status.
function isSettled(milestoneStatus) {
  return milestoneStatus === 'paid'
}

// Aggregate reputation numbers for a provider. Backend-backed for real
// (UUID) users: GET /users/{id}/reputation is derived server-side from the
// provider's own contracts (revenue, averageRating, reviewCount,
// completedContractCount, completedMilestoneCount, totalMilestoneCount,
// profileBoosterPct). Ratings are never writable from the client.
// TEMPORARY: seeded mock ids keep the local contract-math fallback below.
export async function getProviderReputation(userId) {
  if (isBackendId(userId)) {
    return http.get(`/users/${userId}/reputation`)
  }

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
// Backend-backed for real users: GET /users/{id}/completed-contracts returns
// a safe subset (id, askId, askTitle, agreedPrice, currency, status,
// completedAt, rating, review — no seeker ids, no milestone rows), adapted
// here to the shape the page joins on; the page's existing fallbacks cover
// the missing joins (client name, milestone counts).
export async function getCompletedContractsForProvider(userId) {
  if (isBackendId(userId)) {
    const page = await http.get(`/users/${userId}/completed-contracts`)
    return (page?.items ?? []).map((item) => ({
      ...item,
      seekerId: null,
      milestones: [],
    }))
  }

  await delay()

  return contracts
    .filter((contract) => contract.providerId === userId && contract.status === 'completed')
    .slice()
    .sort((a, b) => new Date(b.completedAt ?? b.createdAt) - new Date(a.completedAt ?? a.createdAt))
    .map((contract) => structuredClone(contract))
}
