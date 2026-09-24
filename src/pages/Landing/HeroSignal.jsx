import { motion } from 'framer-motion'
import SignalMark from '../../components/ui/SignalMark'
import styles from './HeroSignal.module.css'

// One ASK, radiating out to real providers who respond — makes the
// reverse-marketplace idea legible without text: post once, skilled
// people come to you. Plays once on mount (no loop), respects
// prefers-reduced-motion automatically via MotionConfig.
const OFFERS = [
  { id: 'design', top: '6%', name: 'Maya R.', role: 'Designer', price: '$450' },
  { id: 'writing', top: '42%', name: 'Theo W.', role: 'Writer', price: '$220' },
  { id: 'dev', top: '78%', name: 'Chen L.', role: 'Developer', price: '$600' },
]

const PATHS = [
  'M 72 200 C 170 120, 250 80, 340 50',
  'M 72 200 C 170 200, 250 200, 340 200',
  'M 72 200 C 170 280, 250 320, 340 350',
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
            animate={{ pathLength: 1, opacity: 0.55 }}
            transition={{ duration: 1, ease: 'easeInOut', delay: 0.5 + index * 0.15 }}
          />
        ))}
      </svg>

      <div className={styles.markWrap}>
        <SignalMark size="md" rings={2} animated />
      </div>

      <div className={styles.askChip}>
        <span className={styles.askEyebrow}>Your ASK</span>
        <span className={styles.askTitle}>Logo for a new bakery</span>
      </div>

      {OFFERS.map((offer, index) => (
        <motion.div
          key={offer.id}
          className={styles.offerChip}
          style={{ top: offer.top }}
          initial={{ opacity: 0, x: 12, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.45, delay: 1 + index * 0.15, ease: 'easeOut' }}
        >
          <span className={styles.offerAvatar} aria-hidden="true">
            {offer.name.charAt(0)}
          </span>
          <div>
            <p className={styles.offerLabel}>
              {offer.name} <span className={styles.offerRole}>· {offer.role}</span>
            </p>
            <p className={styles.offerPrice}>{offer.price}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
