import { motion } from 'framer-motion'
import Card from '../Card'
import { hoverLift } from '../../../utils/motion'
import styles from './FloatingCard.module.css'

// A Card that lifts on hover/focus and casts a deeper, directional shadow —
// the "floating layered card" motif from the Open Call strategy. A thin
// wrapper over the existing Card atom, not a replacement for it: reach for
// this when a card should read as an interactive, physical object (e.g.
// a sample-ASK or offer preview), and plain Card everywhere else.
export default function FloatingCard({ children, padding = 'md', className = '', ...rest }) {
  return (
    <motion.div
      className={[styles.wrap, className].filter(Boolean).join(' ')}
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileFocus="hover"
      variants={hoverLift}
    >
      <Card padding={padding} className={styles.card} {...rest}>
        {children}
      </Card>
    </motion.div>
  )
}
