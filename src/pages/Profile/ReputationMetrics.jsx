import { useState } from 'react'
import { formatCurrency } from '../../utils/formatCurrency'
import styles from './ReputationMetrics.module.css'

export default function ReputationMetrics({
  averageRating,
  reviewCount,
  completedContractCount,
  revenue,
  profileBoosterPct,
}) {
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <div className={styles.metrics}>
      <div className={styles.tile}>
        <span className={styles.label}>Average Rating</span>
        <span className={styles.value}>{averageRating != null ? `${averageRating.toFixed(1)} / 5` : '— / 5'}</span>
        <span className={styles.caption}>
          {reviewCount > 0 ? `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}
        </span>
      </div>

      <div className={styles.tile}>
        <span className={styles.label}>Completed Contracts</span>
        <span className={styles.value}>{completedContractCount}</span>
      </div>

      <div className={styles.tile}>
        <span className={styles.label}>Total Revenue</span>
        <span className={styles.value}>{formatCurrency(revenue, 'USD')}</span>
      </div>

      <div className={styles.tile}>
        <div className={styles.boosterHeader}>
          <span className={styles.label}>Profile Booster</span>
          <button
            type="button"
            className={styles.infoButton}
            aria-expanded={infoOpen}
            aria-controls="profile-booster-info"
            onClick={() => setInfoOpen((open) => !open)}
          >
            <span aria-hidden="true">ⓘ</span>
            <span className="sr-only">How Profile Booster works</span>
          </button>
        </div>
        <span className={styles.value}>+{profileBoosterPct}%</span>
        {infoOpen && (
          <p id="profile-booster-info" className={styles.boosterInfo}>
            Profile Booster reflects reputation signals — completed milestones, completed contracts and positive
            ratings. It doesn't guarantee marketplace ranking or visibility.
          </p>
        )}
      </div>
    </div>
  )
}
