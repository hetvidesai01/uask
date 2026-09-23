import { motion } from 'framer-motion'
import { useInView } from '../../hooks/useInView'
import { staggerContainer, staggerItem } from '../../utils/motion'
import styles from './HowItWorksSection.module.css'

const STEPS = [
  {
    label: 'ASK',
    description: 'Post what you need — a short description, your budget, and a rough timeline. Takes a couple of minutes.',
  },
  {
    label: 'MATCH',
    description: 'UASK surfaces your ASK to providers who actually work in that category, so the right people see it fast.',
  },
  {
    label: 'RESPOND',
    description: 'Interested providers send offers back — their price, timeline, and a short note on how they would approach it.',
  },
  {
    label: 'COMPARE',
    description: "Every offer lands in one place. Line them up side by side and pick whoever's the best fit — not just the cheapest.",
  },
  {
    label: 'CONNECT',
    description: 'Accept an offer, and UASK sets up a contract with milestones so both sides know exactly what happens next.',
  },
]

const RAIL_VARIANTS = {
  hidden: { scaleX: 0, scaleY: 0 },
  visible: { scaleX: 1, scaleY: 1 },
}

export default function HowItWorksSection() {
  const [ref, isInView] = useInView({ threshold: 0.15 })

  return (
    <section id="how-it-works" className={`section ${styles.flow}`}>
      <div className="container">
        <span className={styles.kicker}>How UASK works</span>
        <h2 className={styles.heading}>One flow, from ASK to CONNECT</h2>
        <p className={styles.intro}>
          UASK is a reverse marketplace — you don't go looking for providers, they come to you. Here's the whole
          flow in five simple steps.
        </p>

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
