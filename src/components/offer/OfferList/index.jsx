import { RevealGroup, Reveal } from '../../ui/Reveal'
import EmptyState from '../../ui/EmptyState'
import MotionCard from '../../ui/MotionCard'
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
    <RevealGroup className={styles.list}>
      {offers.map((offer) => (
        <Reveal key={offer.id}>
          <MotionCard lift={2}>
            <OfferCard offer={offer} provider={providersById[offer.providerId]} />
          </MotionCard>
        </Reveal>
      ))}
    </RevealGroup>
  )
}
