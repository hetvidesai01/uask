import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Tag from '../../components/ui/Tag'
import { OWNERSHIP_OPTIONS, PORTFOLIO_OPTIONS, labelFor } from '../../utils/contractMath'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../utils/formatDate'
import styles from './ContractParts.module.css'

function Section({ id, title, summary, open, onToggle, children }) {
  return (
    <div className={styles.accItem}>
      <h3 className={styles.accHeading}>
        <button
          type="button"
          className={styles.accTrigger}
          aria-expanded={open}
          aria-controls={`contract-sec-${id}`}
          onClick={onToggle}
        >
          <span className={styles.accTitle}>{title}</span>
          <span className={styles.accSummary}>{summary}</span>
          <span className={[styles.chevron, open ? styles.chevronOpen : ''].filter(Boolean).join(' ')} aria-hidden="true">
            ▾
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`contract-sec-${id}`}
            role="region"
            className={styles.accPanelWrap}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.accPanel}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ label, value, muted, strong }) {
  return (
    <div className={styles.feeRow}>
      <span className={muted ? styles.feeMuted : undefined}>{label}</span>
      <span className={strong ? styles.feeStrong : undefined}>{value}</span>
    </div>
  )
}

export default function ContractDetails({ contract, ask }) {
  const [openId, setOpenId] = useState('scope')
  const toggle = (id) => setOpenId((current) => (current === id ? null : id))

  const { currency, agreedPrice, fees } = contract
  const clientFee = Math.round((agreedPrice * fees.clientPlatformFeePct) / 100)
  const commission = Math.round((agreedPrice * fees.freelancerCommissionPct) / 100)

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>Contract details</h2>
      <div className={styles.acc}>
        <Section
          id="scope"
          title="Scope & deliverables"
          summary={`${contract.deliverables.length} deliverable${contract.deliverables.length === 1 ? '' : 's'}`}
          open={openId === 'scope'}
          onToggle={() => toggle('scope')}
        >
          {ask?.title && <p className={styles.detailLine}><span>ASK</span> {ask.title}</p>}
          <p className={styles.scopeText}>{contract.scope}</p>
          <div className={styles.tagRow}>
            {contract.deliverables.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </div>
          <p className={styles.detailLine}><span>Deadline</span> {formatAbsoluteDate(contract.deadline)}</p>
          <p className={styles.detailLine}>
            <span>Included revisions</span> {contract.revisionsIncluded}
          </p>
        </Section>

        <Section
          id="rights"
          title="Ownership & confidentiality"
          summary={contract.confidentiality ? 'Confidential' : 'No confidentiality'}
          open={openId === 'rights'}
          onToggle={() => toggle('rights')}
        >
          <p className={styles.detailLine}>
            <span>Deliverable ownership</span> {labelFor(OWNERSHIP_OPTIONS, contract.ownership)}
          </p>
          <p className={styles.detailLine}>
            <span>Portfolio permission</span> {labelFor(PORTFOLIO_OPTIONS, contract.portfolioPermission)}
          </p>
          <p className={styles.detailLine}>
            <span>Confidentiality</span>{' '}
            {contract.confidentiality ? '✓ Both parties agree to keep project information confidential' : 'Not requested'}
          </p>
        </Section>

        <Section
          id="fees"
          title="Fees"
          summary={`Edits used: ${contract.editCount}`}
          open={openId === 'fees'}
          onToggle={() => toggle('fees')}
        >
          <Row label="Project value" value={formatCurrency(agreedPrice, currency)} strong />
          <Row
            label={`Client platform fee (${fees.clientPlatformFeePct}% · demo rate)`}
            value={formatCurrency(clientFee, currency)}
          />
          <Row
            label={`Freelancer commission (${fees.freelancerCommissionPct}% · demo rate)`}
            value={formatCurrency(commission, currency)}
          />
          <Row
            label="Contract edit fees (demo)"
            value={contract.editFeesTotal > 0 ? formatCurrency(contract.editFeesTotal, currency) : 'None'}
          />
          <p className={styles.fine}>
            Shown separately and not included in the project value. Demo values only — nothing is charged. GST is not
            displayed in this demo.
          </p>
        </Section>
      </div>
    </div>
  )
}
