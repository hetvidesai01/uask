import EmptyState from '../../ui/EmptyState'
import OfferCard from '../OfferCard'
import styles from './OfferList.module.css'

export default function OfferList({ offers, providersById }) {
  if (offers.length === 0) {
    return (
      <EmptyState
        icon="📭"
        title="No responses yet"
        message="Providers who respond to this ASK will show up here."
      />
    )
  }

  return (
    <div className={styles.list}>
      {offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} provider={providersById[offer.providerId]} />
      ))}
    </div>
  )
}
