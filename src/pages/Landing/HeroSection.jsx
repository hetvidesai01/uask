import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../../components/ui/Button'
import GradientMesh from '../../components/ui/GradientMesh'
import HandUnderline from '../../components/ui/HandUnderline'
import HeroSignal from './HeroSignal'
import { hoverLift, staggerContainer, staggerItem } from '../../utils/motion'
import styles from './HeroSection.module.css'

const LINE_TRANSITION = { duration: 0.6, ease: [0.16, 1, 0.3, 1] }

export default function HeroSection() {
  return (
    <section className={styles.hero}>
      <GradientMesh className={styles.mesh} />
      <div className={styles.blob} aria-hidden="true" />
      <div className={`container ${styles.inner}`}>
        <div className={styles.copy}>
          <motion.span
            className={styles.kicker}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className={styles.kickerDot} aria-hidden="true" />
            A reverse marketplace
          </motion.span>

          <h1 className={styles.title}>
            <span className={styles.lineMask}>
              <motion.span
                className={styles.lineInner}
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={LINE_TRANSITION}
              >
                Ask for what you need.
              </motion.span>
            </span>
            <span className={styles.lineMask}>
              <motion.span
                className={styles.lineInner}
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...LINE_TRANSITION, delay: 0.12 }}
              >
                Let the right people <HandUnderline>find</HandUnderline> you.
              </motion.span>
            </span>
          </h1>

          <motion.div
            className={styles.stagger}
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            transition={{ staggerChildren: 0.12, delayChildren: 0.55 }}
          >
            <motion.p className={styles.subtitle} variants={staggerItem}>
              Post what you need — qualified providers see it and respond with real offers. No
              searching, no cold outreach.
            </motion.p>

            <motion.div className={styles.actions} variants={staggerItem}>
              <motion.div initial="rest" whileHover="hover" whileTap={{ scale: 0.97 }} variants={hoverLift}>
                <Button as={Link} to="/signup" size="lg">
                  Create ASK
                </Button>
              </motion.div>
              <motion.div initial="rest" whileHover="hover" whileTap={{ scale: 0.97 }} variants={hoverLift}>
                <Button as={Link} to="/app/discover" variant="secondary" size="lg">
                  Discover ASKs
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>

        <div className={styles.graphic}>
          <HeroSignal />
        </div>
      </div>
    </section>
  )
}
