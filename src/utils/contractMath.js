// Pure helpers for the demo contract flow (25–50–25 schedule, edit fees,
// stage display states). No I/O — shared by contractService and the Contract
// page so both compute the same numbers. Prototype only; nothing here moves
// money or charges fees.

export const PAYMENT_STAGES = [
  {
    key: 'initial',
    label: 'Initial Payment',
    percent: 25,
    trigger: 'Marked as paid once both parties have signed the contract.',
  },
  {
    key: 'progress',
    label: 'Progress Payment',
    percent: 50,
    trigger: 'Due at ~60% of the work, after the ASK Side approves the progress milestone.',
  },
  {
    key: 'final',
    label: 'Final Payment',
    percent: 25,
    trigger: 'Due once the final work is submitted and approved by the ASK Side.',
  },
]

export const PROGRESS_CHECKPOINTS = [0, 25, 60, 100]
export const PROGRESS_LOCK_PERCENT = 60

export const FREE_EDITS = 2
export const EDIT_FEE_RATE = 0.025
export const EDIT_FEE_CAP_RATE = 0.075
export const EARLY_TERMINATION_RATE = 0.05

export const OWNERSHIP_OPTIONS = [
  { value: 'transfer_on_final_payment', label: 'Transfers to ASK Side after final payment' },
  { value: 'custom', label: 'Custom agreement' },
]

export const PORTFOLIO_OPTIONS = [
  { value: 'allowed', label: 'Allowed' },
  { value: 'not_allowed', label: 'Not allowed' },
  { value: 'ask_first', label: 'Ask before using' },
]

export const DISPUTE_REASONS = [
  'Work differs from agreed scope',
  'Missed deadline',
  'Communication issue',
  'Payment disagreement',
  'Revision disagreement',
  'Other',
]

export function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label ?? value
}

// Splits the contract value 25/50/25; the final stage absorbs rounding.
export function computeStageAmounts(price) {
  const initial = Math.round(price * 0.25)
  const progress = Math.round(price * 0.5)
  return { initial, progress, final: price - initial - progress }
}

export function ordinal(n) {
  const words = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth' }
  return words[n] ?? `${n}th`
}

// Fee for the *next* edit, given how many edits were already applied and how
// much fee has been recorded so far. Edits 1–2 free, then 2.5% each, with the
// running total capped at 7.5% of contract value.
export function computeNextEditFee(price, editCount, feesSoFar = 0) {
  const editNumber = editCount + 1
  if (editNumber <= FREE_EDITS) return { editNumber, fee: 0, capped: false }
  const cap = Math.round(price * EDIT_FEE_CAP_RATE)
  const raw = Math.round(price * EDIT_FEE_RATE)
  const fee = Math.max(0, Math.min(raw, cap - feesSoFar))
  return { editNumber, fee, capped: fee < raw }
}

export function getStage(contract, key) {
  return contract.milestones.find((m) => m.stage === key)
}

export function isTermsLocked(contract) {
  return contract.progressPercent >= PROGRESS_LOCK_PERCENT
}

export function isOpenForWork(contract) {
  return contract.status === 'active'
}

// UI state for a payment stage: not_due | due | awaiting_approval | paid | disputed
export function getStageDisplayStatus(contract, stage) {
  if (stage.status === 'paid') return 'paid'
  if (contract.status === 'disputed') return 'disputed'
  if (stage.status === 'submitted') return 'awaiting_approval'
  if (stage.status === 'approved') return 'due'
  if (stage.stage === 'initial' && stage.status === 'upcoming' && contract.status === 'active') return 'due'
  return 'not_due'
}

export function getEditPreview(contract) {
  return computeNextEditFee(contract.agreedPrice, contract.editCount, contract.editFeesTotal)
}

// Before the 60% progress milestone: a normal edit (counts toward the
// free-edit allowance / demo fee). After it: terms are locked, so only a
// mutually approved amendment — or, while disputed, a dispute correction.
export function getChangeKind(contract) {
  if (contract.status === 'disputed') return 'dispute_correction'
  if (isTermsLocked(contract)) return 'amendment'
  return 'edit'
}
