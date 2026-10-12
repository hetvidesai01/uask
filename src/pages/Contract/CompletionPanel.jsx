import Button from '../../components/ui/Button'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../utils/formatDate'
import styles from './ContractParts.module.css'

export default function CompletionPanel({ contract, seekerName, providerName, onOpenInvoice }) {
  const { currency } = contract
  const totalPaid = contract.milestones.filter((m) => m.status === 'paid').reduce((sum, m) => sum + m.amount, 0)

  return (
    <div className={[styles.panel, styles.completePanel].join(' ')}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Contract Complete</h2>
        <span className={styles.metaText}>Completed {formatAbsoluteDate(contract.completedAt)}</span>
      </div>

      <div className={styles.completeGrid}>
        <div>
          <h3 className={styles.subTitle}>Payment history</h3>
          <ul className={styles.paymentHistory}>
            {contract.milestones.map((m) => (
              <li key={m.id}>
                <span>
                  {m.title} · {m.percent}%
                  {m.paidAt && <span className={styles.feeMuted}> · {formatAbsoluteDate(m.paidAt)}</span>}
                </span>
                <strong>{formatCurrency(m.amount, currency)}</strong>
              </li>
            ))}
            <li className={styles.paymentTotal}>
              <span>Total marked as paid (demo)</span>
              <strong>{formatCurrency(totalPaid, currency)}</strong>
            </li>
          </ul>
        </div>

        <div>
          <h3 className={styles.subTitle}>Contract summary</h3>
          <dl className={styles.summaryList}>
            <div><dt>ASK Side</dt><dd>{seekerName ?? '—'}</dd></div>
            <div><dt>Respond Side</dt><dd>{providerName ?? '—'}</dd></div>
            <div><dt>Project value</dt><dd>{formatCurrency(contract.agreedPrice, currency)}</dd></div>
            <div><dt>Revisions used</dt><dd>{contract.revisionsUsed} / {contract.revisionsIncluded}</dd></div>
            <div><dt>Contract edits</dt><dd>{contract.editCount}</dd></div>
          </dl>
        </div>
      </div>

      <div className={styles.completeActions}>
        <Button variant="secondary" onClick={onOpenInvoice}>
          View demo invoice
        </Button>
      </div>
      <p className={styles.demoNote}>Demo payment flow — no real transaction</p>
    </div>
  )
}
