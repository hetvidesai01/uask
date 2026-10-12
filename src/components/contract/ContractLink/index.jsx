import { Link } from 'react-router-dom'
import ContractStatusBadge from '../ContractStatusBadge'
import styles from './ContractLink.module.css'

// Contextual entry point to an ASK's Contract page: the contract's current
// status plus an "Open Contract" link. `compact` drops the status badge for
// tight spots like the Inbox thread header.
export default function ContractLink({ contract, compact = false }) {
  if (!contract) return null
  return (
    <div className={[styles.wrap, compact ? styles.compact : ''].filter(Boolean).join(' ')}>
      {!compact && <ContractStatusBadge status={contract.status} />}
      <Link to={`/app/asks/${contract.askId}/contract`} className={styles.link}>
        {compact ? 'View Contract' : 'Open Contract'} →
      </Link>
    </div>
  )
}
