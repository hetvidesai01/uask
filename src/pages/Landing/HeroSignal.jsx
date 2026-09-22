import { motion } from 'framer-motion'
import styles from './HeroSignal.module.css'

// One ASK, radiating out to several provider responses — a small custom
// graphic that makes the reverse-marketplace idea legible without text.
const OFFERS = [
  { id: 'design', top: '10%', price: '$450', label: 'Design offer' },
  { id: 'writing', top: '46%', price: '$220', label: 'Writing offer' },
  { id: 'dev', top: '82%', price: '$600', label: 'Dev offer' },
]

const PATHS = [
  'M 60 200 C 160 120, 240 80, 340 60',
  'M 60 200 C 160 200, 240 200, 340 200',
  'M 60 200 C 160 280, 240 320, 340 340',
]

export default function HeroSignal() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <svg className={styles.svg} viewBox="0 0 400 400" fill="none">
        {PATHS.map((d, index) => (
          <motion.path
            key={d}
            d={d}
            stroke="var(--c-red)"
            strokeWidth="1.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.6 }}
            transition={{ duration: 1, ease: 'easeInOut', delay: 0.5 + index * 0.15 }}
          />
        ))}
        <motion.circle
          cx="60"
          cy="200"
          r="10"
          fill="var(--c-red)"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        />
      </svg>

      <div className={styles.askChip}>
        <span className={styles.askDot} />
        Your ASK
      </div>

      {OFFERS.map((offer, index) => (
        <motion.div
          key={offer.id}
          className={styles.offerChip}
          style={{ top: offer.top }}
          initial={{ opacity: 0, x: 12, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.9 + index * 0.15, ease: 'easeOut' }}
        >
          <span className={styles.offerAvatar} aria-hidden="true" />
          <div>
            <p className={styles.offerLabel}>{offer.label}</p>
            <p className={styles.offerPrice}>{offer.price}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
