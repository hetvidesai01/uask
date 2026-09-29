import Card from '../../ui/Card'
import UserMiniCard from '../../ask/UserMiniCard'
import OfferStatusBadge from '../OfferStatusBadge'
import { formatCurrency } from '../../../utils/formatCurrency'
import { formatRelativeDate } from '../../../utils/formatDate'
import styles from './OfferCard.module.css'

// `tag` is an optional mock "smart summary" label (e.g. "Best value") and
// `matchReasoning` an optional compact "Matched: ..." line — both are
// presentational only, sourced from data the caller already has (see
// Compare Responses); neither implies a real AI/matching engine yet.
export default function OfferCard({ offer, provider, actions, tag, matchReasoning }) {
  const isAccepted = offer.status === 'accepted'

  return (
    <Card className={[styles.card, isAccepted ? styles.accepted : ''].filter(Boolean).join(' ')}>
      <div className={styles.top}>
        <UserMiniCard user={provider} />
        <div className={styles.badges}>
          {tag && <span className={styles.summaryTag}>{tag}</span>}
          <OfferStatusBadge status={offer.status} />
        </div>
      </div>

      {matchReasoning && <p className={styles.matchReasoning}>{matchReasoning}</p>}

      <div className={styles.terms}>
        <span className={styles.price}>{formatCurrency(offer.price, offer.currency)}</span>
        <span className={styles.dot} aria-hidden="true">
          &middot;
        </span>
        <span>{offer.deliveryDays}-day delivery</span>
      </div>

      <p className={styles.pitch}>{offer.pitch}</p>

      {offer.deliverables.length > 0 && (
        <ul className={styles.deliverables}>
          {offer.deliverables.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      <div className={styles.footer}>
        <span>Submitted {formatRelativeDate(offer.createdAt)}</span>
      </div>

      {actions && <div className={styles.actions}>{actions}</div>}
    </Card>
  )
}
