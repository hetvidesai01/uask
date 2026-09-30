import { motion } from 'framer-motion'
import StaggerReveal from '../../components/ui/StaggerReveal'
import { staggerItem } from '../../utils/motion'
import SignalRail from '../../components/ui/SignalRail'
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

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className={`section ${styles.flow}`}>
      <div className="container">
        <StaggerReveal>
          <motion.span className={styles.kicker} variants={staggerItem}>
            How UASK works
          </motion.span>
          <motion.h2 className={styles.heading} variants={staggerItem}>
            One flow, from ASK to CONNECT
          </motion.h2>
          <motion.p className={styles.intro} variants={staggerItem}>
            UASK is a reverse marketplace — you don't go looking for providers, they come to you. Here's the whole
            flow in five simple steps.
          </motion.p>
        </StaggerReveal>

        <SignalRail steps={STEPS} />
      </div>
    </section>
  )
}
