import { useState } from 'react'
import { motion } from 'framer-motion'
import AnimatedCounter from '../../components/ui/AnimatedCounter'
import SpringFill from '../../components/ui/SpringFill'
import { revealGroup, revealItem, SOFT_SPRING } from '../../utils/motion'
import { formatCurrency, DEFAULT_CURRENCY } from '../../utils/formatCurrency'
import styles from './ReputationMetrics.module.css'

// Mirrors the "+X%" formula's ceiling (see getProviderReputation): the
// booster tops out at +20%, so the bar shows progress toward that.
const BOOSTER_MAX_PCT = 20

export default function ReputationMetrics({
  averageRating,
  reviewCount,
  completedContractCount,
  revenue,
  profileBoosterPct,
}) {
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <motion.div className={styles.metrics} initial="hidden" animate="visible" variants={revealGroup}>
      <motion.div className={styles.tile} variants={revealItem} whileHover={{ y: -3 }} transition={SOFT_SPRING}>
        <span className={styles.label}>Average Rating</span>
        <span className={styles.value}>
          {averageRating != null ? (
            <AnimatedCounter
              value={Math.round(averageRating * 10)}
              format={(n) => `${(n / 10).toFixed(1)} / 5`}
              duration={0.9}
            />
          ) : (
            '— / 5'
          )}
        </span>
        <span className={styles.caption}>
          {reviewCount > 0 ? `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}
        </span>
      </motion.div>

      <motion.div className={styles.tile} variants={revealItem} whileHover={{ y: -3 }} transition={SOFT_SPRING}>
        <span className={styles.label}>Completed Contracts</span>
        <span className={styles.value}>
          <AnimatedCounter value={completedContractCount} />
        </span>
      </motion.div>

      <motion.div className={styles.tile} variants={revealItem} whileHover={{ y: -3 }} transition={SOFT_SPRING}>
        <span className={styles.label}>Total Revenue</span>
        <span className={styles.value}>
          <AnimatedCounter value={revenue} duration={1} format={(n) => formatCurrency(n, DEFAULT_CURRENCY)} />
        </span>
      </motion.div>

      <motion.div className={styles.tile} variants={revealItem} whileHover={{ y: -3 }} transition={SOFT_SPRING}>
        <div className={styles.boosterHeader}>
          <span className={styles.label}>Profile Booster</span>
          <span className={styles.tooltipWrap}>
            <button
              type="button"
              className={styles.infoButton}
              aria-expanded={infoOpen}
              aria-describedby="profile-booster-info"
              onClick={() => setInfoOpen((open) => !open)}
            >
              <span aria-hidden="true">ⓘ</span>
              <span className="sr-only">How Profile Booster works</span>
            </button>
            <span
              role="tooltip"
              id="profile-booster-info"
              className={[styles.tooltip, infoOpen ? styles.tooltipVisible : ''].filter(Boolean).join(' ')}
            >
              Complete milestones, contracts and earn strong ratings to strengthen your UASK profile.
            </span>
          </span>
        </div>
        <span className={styles.value}>
          +<AnimatedCounter value={profileBoosterPct} />%
        </span>
        <div className={styles.boosterTrack} aria-hidden="true">
          <SpringFill
            className={styles.boosterFill}
            value={(profileBoosterPct / BOOSTER_MAX_PCT) * 100}
            delay={0.2}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
