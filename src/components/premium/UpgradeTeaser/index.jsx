import { motion } from 'framer-motion'
import styles from './UpgradeTeaser.module.css'

const ENTRANCE_TRANSITION = { type: 'spring', stiffness: 260, damping: 22, delay: 0.6 }
const SLIDE_TRANSITION = { duration: 0.25, ease: 'easeOut' }

// A small curiosity hook, not a persistent sales card: rests mostly off
// the right edge of the viewport, slides fully into view on hover/focus,
// and opens the full Basic vs Premium comparison in a PremiumDrawer on
// click. Always visible for a non-Premium user — no dismiss/collapse
// state, since being a quiet constant is the point.
export default function UpgradeTeaser({ onOpen }) {
  return (
    <motion.button
      type="button"
      className={styles.teaser}
      onClick={onOpen}
      aria-label="Open UASK Premium — see plans and upgrade"
      initial={{ x: '100%', y: '-50%', opacity: 0 }}
      animate={{ x: '58%', y: '-50%', opacity: 1, transition: ENTRANCE_TRANSITION }}
      whileHover={{ x: '0%', y: '-50%', transition: SLIDE_TRANSITION }}
      whileFocus={{ x: '0%', y: '-50%', transition: SLIDE_TRANSITION }}
      whileTap={{ scale: 0.96 }}
    >
      <span className={styles.iconBadge} aria-hidden="true">
        💎
      </span>
      <span className={styles.label}>Go Premium</span>
    </motion.button>
  )
}
