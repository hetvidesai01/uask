import { motion } from 'framer-motion'
import styles from './UpgradeTeaser.module.css'

const ENTRANCE_TRANSITION = { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.6 }
const SLIDE_TRANSITION = { duration: 0.18, ease: 'easeOut' }

// A vertical tab flush against the right edge of the viewport reading
// "GO PREMIUM". Slides in once on mount, slides slightly further out on
// hover/focus, and opens the Premium drawer on click (drawer, pricing and
// checkout are unchanged). Always visible for a non-Premium user.
export default function UpgradeTeaser({ onOpen }) {
  return (
    <motion.button
      type="button"
      className={styles.teaser}
      onClick={onOpen}
      aria-label="Open UASK Premium — see plans and upgrade"
      initial={{ x: '100%', y: '-50%', opacity: 0 }}
      animate={{ x: 0, y: '-50%', opacity: 1, transition: ENTRANCE_TRANSITION }}
      whileHover={{ x: -8, y: '-50%', transition: SLIDE_TRANSITION }}
      whileFocus={{ x: -8, y: '-50%', transition: SLIDE_TRANSITION }}
      whileTap={{ x: -4, y: '-50%', transition: SLIDE_TRANSITION }}
    >
      <span className={styles.label} aria-hidden="true">
        GO PREMIUM
      </span>
    </motion.button>
  )
}
