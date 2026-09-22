import { motion } from 'framer-motion'
import { useInView } from '../../hooks/useInView'
import { staggerContainer, staggerItem } from '../../utils/motion'
import styles from './FlowSection.module.css'

const STEPS = [
  { label: 'ASK', description: 'Post what you need in a couple of minutes.' },
  { label: 'MATCH', description: 'Relevant providers see your ASK right away.' },
  { label: 'RESPOND', description: 'They send offers with price and timeline.' },
  { label: 'COMPARE', description: 'Line every offer up side by side.' },
  { label: 'CONNECT', description: 'Pick one and start the work.' },
]

const RAIL_VARIANTS = {
  hidden: { scaleX: 0, scaleY: 0 },
  visible: { scaleX: 1, scaleY: 1 },
}

export default function FlowSection() {
  const [ref, isInView] = useInView({ threshold: 0.15 })

  return (
    <section id="how-it-works" className={`section ${styles.flow}`}>
      <div className="container">
        <h2 className={styles.heading}>How UASK works</h2>

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

          {STEPS.map((step, index) => (
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
      </div>
    </section>
  )
}
