import Card from '../../ui/Card'
import UserMiniCard from '../../ask/UserMiniCard'
import OfferStatusBadge from '../OfferStatusBadge'
import { formatCurrency } from '../../../utils/formatCurrency'
import { formatRelativeDate } from '../../../utils/formatDate'
import styles from './OfferCard.module.css'

export default function OfferCard({ offer, provider }) {
  return (
    <Card className={styles.card}>
      <div className={styles.top}>
        <UserMiniCard user={provider} />
        <OfferStatusBadge status={offer.status} />
      </div>

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
    </Card>
  )
}
