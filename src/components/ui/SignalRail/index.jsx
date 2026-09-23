import { motion } from 'framer-motion'
import { useInView } from '../../../hooks/useInView'
import { staggerContainer, staggerItem } from '../../../utils/motion'
import styles from './SignalRail.module.css'

const RAIL_VARIANTS = {
  hidden: { scaleX: 0, scaleY: 0 },
  visible: { scaleX: 1, scaleY: 1 },
}

// The ASK→MATCH→RESPOND→COMPARE→CONNECT "signal rail" visual — a
// scroll-reveal rail with numbered step markers. Shared by Landing's
// FlowSection and Help's HowItWorksSection so the two stay visually
// identical without duplicating the animation/markup.
export default function SignalRail({ steps }) {
  const [ref, isInView] = useInView({ threshold: 0.15 })

  return (
    <motion.div
      ref={ref}
      className={styles.steps}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={staggerContainer}
      transition={{ staggerChildren: 0.15, delayChildren: 0.1 }}
    >
      <motion.div
        className={styles.rail}
        variants={RAIL_VARIANTS}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />

      {steps.map((step, index) => (
        <motion.div
          key={step.label}
          className={[styles.step, isInView ? styles.active : ''].filter(Boolean).join(' ')}
          variants={staggerItem}
        >
          <div className={styles.marker}>
            <span className={styles.ghostNumeral} aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className={styles.dot} />
          </div>
          <div>
            <p className={styles.label}>{step.label}</p>
            <p className={styles.description}>{step.description}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
