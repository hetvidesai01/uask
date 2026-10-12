import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { formatAbsoluteDateTime } from '../../utils/formatDate'
import styles from './ContractParts.module.css'

function PartyCard({ title, name, signature, isYou }) {
  return (
    <div className={[styles.party, signature.signed ? styles.partySigned : ''].filter(Boolean).join(' ')}>
      <div className={styles.partyTop}>
        <span className={styles.partyRole}>{title}</span>
        <Badge variant={signature.signed ? 'accepted' : 'in_review'}>{signature.signed ? 'Signed' : 'Pending'}</Badge>
      </div>
      <p className={styles.partyName}>
        {name ?? '—'}
        {isYou && <span className={styles.youTag}>You</span>}
      </p>
      <p className={styles.partyMeta}>
        {signature.signed ? `Agreed ${formatAbsoluteDateTime(signature.signedAt)}` : 'Has not agreed yet'}
      </p>
    </div>
  )
}

// Demo electronic acceptance only — not a real digital/legal signature.
export default function SigningPanel({ contract, role, seekerName, providerName, onSign, signing, onOpenTerms }) {
  const { seeker, provider } = contract.signatures
  const bothSigned = seeker.signed && provider.signed
  const canSign =
    (contract.status === 'draft' || contract.status === 'awaiting_signatures') && !contract.signatures[role].signed
  const waitingOnOther =
    (contract.status === 'draft' || contract.status === 'awaiting_signatures') && contract.signatures[role].signed

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Both parties agree</h2>
        {bothSigned && contract.status !== 'cancelled' && <Badge variant="open">Contract Active</Badge>}
      </div>

      <div className={styles.partyGrid}>
        <PartyCard title="ASK Side" name={seekerName} signature={seeker} isYou={role === 'seeker'} />
        <PartyCard title="Respond Side" name={providerName} signature={provider} isYou={role === 'provider'} />
      </div>

      {canSign && (
        <div className={styles.signRow}>
          <p className={styles.fine}>
            By selecting <strong>I Agree &amp; Sign</strong>, you confirm you have read and understood the{' '}
            <button type="button" className={styles.linkButton} onClick={onOpenTerms}>
              demo Terms &amp; Conditions
            </button>{' '}
            and these contract details. The contract becomes active only after both sides sign.
          </p>
          <Button onClick={onSign} loading={signing} disabled={Boolean(contract.pendingChange)}>
            I Agree &amp; Sign
          </Button>
          {contract.pendingChange && <p className={styles.fine}>Resolve the pending change before signing.</p>}
        </div>
      )}

      {waitingOnOther && (
        <p className={styles.fine}>You have signed. Waiting for the other party to agree.</p>
      )}

      <p className={styles.fine}>Demo electronic acceptance — not a real digital or legal signature.</p>
    </div>
  )
}
