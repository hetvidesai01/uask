import { useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import {
  DISPUTE_REASONS,
  EARLY_TERMINATION_RATE,
  OWNERSHIP_OPTIONS,
  PORTFOLIO_OPTIONS,
  getChangeKind,
  getEditPreview,
  ordinal,
} from '../../utils/contractMath'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../utils/formatDate'
import styles from './ContractParts.module.css'

const dateOnly = (iso) => iso.slice(0, 10)

// ── Propose change / edit ────────────────────────────────────────────────

function ChangeForm({ contract, onClose, onSubmit, submitting }) {
  const kind = getChangeKind(contract)
  const preview = getEditPreview(contract)
  const anyPaid = contract.milestones.some((m) => m.status === 'paid')

  const [scope, setScope] = useState(contract.scope)
  const [deadline, setDeadline] = useState(dateOnly(contract.deadline))
  const [revisions, setRevisions] = useState(String(contract.revisionsIncluded))
  const [price, setPrice] = useState(String(contract.agreedPrice))
  const [ownership, setOwnership] = useState(contract.ownership)
  const [portfolio, setPortfolio] = useState(contract.portfolioPermission)
  const [confidentiality, setConfidentiality] = useState(contract.confidentiality)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const changes = {}
    if (scope.trim() !== contract.scope) changes.scope = scope.trim()
    if (deadline !== dateOnly(contract.deadline)) changes.deadline = new Date(`${deadline}T00:00:00.000Z`).toISOString()
    if (Number(revisions) !== contract.revisionsIncluded) changes.revisionsIncluded = Number(revisions)
    if (Number(price) !== contract.agreedPrice) changes.agreedPrice = Number(price)
    if (ownership !== contract.ownership) changes.ownership = ownership
    if (portfolio !== contract.portfolioPermission) changes.portfolioPermission = portfolio
    if (confidentiality !== contract.confidentiality) changes.confidentiality = confidentiality

    if (!scope.trim()) return setError('Scope cannot be empty.')
    if (!deadline) return setError('Choose a deadline.')
    if (!Number.isInteger(Number(revisions)) || Number(revisions) < contract.revisionsUsed) {
      return setError(`Included revisions must be a whole number of at least ${contract.revisionsUsed}.`)
    }
    if (!(Number(price) > 0)) return setError('Enter a valid price.')
    if (Object.keys(changes).length === 0) return setError('Change at least one term to propose.')
    if (kind !== 'edit' && !note.trim()) return setError('Add a short note explaining the change.')

    setError('')
    onSubmit({ changes, note })
  }

  return (
    <form className={styles.modalForm} onSubmit={handleSubmit}>
      <p className={styles.fine}>
        {kind === 'edit'
          ? 'Changes apply once the other party approves them. If signatures were already given, both sides sign again.'
          : 'Contract terms are locked after the progress milestone. This is a separate, mutually approved action — it applies only when the other party approves.'}
      </p>

      <Textarea label="Scope" value={scope} onChange={(e) => setScope(e.target.value)} maxLength={400} />
      <div className={styles.formGrid}>
        <Input label="Deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <Input
          label="Included revisions"
          type="number"
          min={contract.revisionsUsed}
          value={revisions}
          onChange={(e) => setRevisions(e.target.value)}
        />
        <Input
          label={`Agreed price (${contract.currency})`}
          type="number"
          min={1}
          value={price}
          disabled={anyPaid}
          hint={anyPaid ? 'Locked once a payment is marked as paid.' : undefined}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Select
          label="Deliverable ownership"
          options={OWNERSHIP_OPTIONS}
          value={ownership}
          onChange={(e) => setOwnership(e.target.value)}
        />
        <Select
          label="Portfolio permission"
          options={PORTFOLIO_OPTIONS}
          value={portfolio}
          onChange={(e) => setPortfolio(e.target.value)}
        />
      </div>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={confidentiality} onChange={(e) => setConfidentiality(e.target.checked)} />
        <span>Both parties agree to keep project information confidential</span>
      </label>

      {kind !== 'edit' && (
        <Textarea
          label="Why is this change needed?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
        />
      )}

      {kind === 'edit' && (
        <div className={styles.feeBox}>
          <p className={styles.feeBoxTitle}>
            {preview.fee > 0
              ? `This is the ${ordinal(preview.editNumber)} contract edit.`
              : `This would be contract edit ${preview.editNumber} — the first 2 edits are free.`}
          </p>
          <p>
            Demo contract-edit fee: <strong>{formatCurrency(preview.fee, contract.currency)}</strong>
            {preview.capped && ' (capped at 7.5% of contract value)'}
          </p>
          <p className={styles.fine}>This fee is shown for prototype purposes only and is not charged.</p>
        </div>
      )}

      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}

      <div className={styles.modalActions}>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {kind === 'edit' ? 'Propose change' : 'Send proposal'}
        </Button>
      </div>
    </form>
  )
}

export function ProposeChangeModal({ open, onClose, contract, onSubmit, submitting }) {
  const kind = getChangeKind(contract)
  const title =
    kind === 'edit' ? 'Edit contract' : kind === 'amendment' ? 'Propose an amendment' : 'Propose a dispute correction'
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <ChangeForm contract={contract} onClose={onClose} onSubmit={onSubmit} submitting={submitting} />
    </Modal>
  )
}

// ── Cancellation ─────────────────────────────────────────────────────────

export function CancellationModal({ open, onClose, contract, onConfirm, submitting }) {
  return (
    <Modal open={open} onClose={onClose} title="Request cancellation">
      <div className={styles.modalForm}>
        <p>
          This sends a cancellation request to the other party. The contract is <strong>not</strong> terminated until
          they accept.
        </p>
        <ul className={styles.plainList}>
          <li>Completed work may remain payable.</li>
          <li>Unused funds follow the agreed refund/dispute process.</li>
          <li>Both parties should communicate before abandoning an active contract.</li>
        </ul>
        <div className={styles.feeBox}>
          <p>
            Proposed demo rule: an early-termination charge of up to {EARLY_TERMINATION_RATE * 100}% of contract value (
            {formatCurrency(Math.round(contract.agreedPrice * EARLY_TERMINATION_RATE), contract.currency)}) may apply to
            unjustified termination after work begins, subject to actual loss, applicable law and dispute review.
          </p>
          <p className={styles.feeBoxTitle}>This charge is not automatic. Nothing is deducted.</p>
        </div>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={onClose}>
            Keep contract
          </Button>
          <Button variant="danger" loading={submitting} onClick={onConfirm}>
            Send cancellation request
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Dispute ──────────────────────────────────────────────────────────────

function DisputeForm({ onClose, onSubmit, submitting }) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    if (!reason) return setError('Select a reason for the dispute.')
    setError('')
    onSubmit({ reason, description })
  }

  return (
    <form className={styles.modalForm} onSubmit={handleSubmit}>
      <Select
        label="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        options={[{ value: '', label: 'Select a reason' }, ...DISPUTE_REASONS.map((r) => ({ value: r, label: r }))]}
      />
      <Textarea
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={400}
      />
      <p className={styles.fine}>
        UASK may review the ASK, accepted response, messages and submitted deliverables to support resolution. Raising a
        dispute pauses payments in this demo; it does not start a legal process.
      </p>
      {error && (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      )}
      <div className={styles.modalActions}>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={submitting}>
          Raise dispute
        </Button>
      </div>
    </form>
  )
}

export function DisputeModal({ open, onClose, onSubmit, submitting }) {
  return (
    <Modal open={open} onClose={onClose} title="Raise a dispute">
      <DisputeForm onClose={onClose} onSubmit={onSubmit} submitting={submitting} />
    </Modal>
  )
}

// ── Demo invoice ─────────────────────────────────────────────────────────

function buildInvoiceLines(contract) {
  const { currency, agreedPrice, fees } = contract
  const lines = contract.milestones.map((m) => ({
    label: `${m.title} (${m.percent}%)${m.paidAt ? ` — marked paid ${formatAbsoluteDate(m.paidAt)}` : ''}`,
    amount: formatCurrency(m.amount, currency),
  }))
  lines.push({ label: 'Project value', amount: formatCurrency(agreedPrice, currency), strong: true })
  lines.push({
    label: `Client platform fee (${fees.clientPlatformFeePct}% demo rate)`,
    amount: formatCurrency(Math.round((agreedPrice * fees.clientPlatformFeePct) / 100), currency),
  })
  lines.push({
    label: `Freelancer commission (${fees.freelancerCommissionPct}% demo rate)`,
    amount: formatCurrency(Math.round((agreedPrice * fees.freelancerCommissionPct) / 100), currency),
  })
  if (contract.editFeesTotal > 0) {
    lines.push({ label: 'Contract edit fees (demo)', amount: formatCurrency(contract.editFeesTotal, currency) })
  }
  return lines
}

export function InvoiceModal({ open, onClose, contract, askTitle, seekerName, providerName }) {
  const lines = buildInvoiceLines(contract)
  const number = `DEMO-${contract.id.toUpperCase()}`

  function handleDownload() {
    const text = [
      'UASK — DEMO INVOICE (prototype only, not a tax invoice)',
      `Invoice: ${number}`,
      `Project: ${askTitle ?? contract.id}`,
      `ASK Side: ${seekerName ?? '—'}`,
      `Respond Side: ${providerName ?? '—'}`,
      '',
      ...lines.map((line) => `${line.label}: ${line.amount}`),
      '',
      'Demo payment flow — no real transaction. GST is not displayed in this demo.',
    ].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${number}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal open={open} onClose={onClose} title="Demo invoice">
      <div className={styles.modalForm}>
        <p className={styles.fine}>
          {number} · {askTitle}
        </p>
        <div className={styles.invoice}>
          {lines.map((line) => (
            <div key={line.label} className={styles.feeRow}>
              <span>{line.label}</span>
              <span className={line.strong ? styles.feeStrong : undefined}>{line.amount}</span>
            </div>
          ))}
        </div>
        <p className={styles.fine}>
          Demo invoice for prototype use — not a tax invoice. No real transaction took place. GST is not displayed in
          this demo.
        </p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleDownload}>Download demo invoice</Button>
        </div>
      </div>
    </Modal>
  )
}
