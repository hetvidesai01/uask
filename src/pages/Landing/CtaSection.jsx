import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../../components/ui/Button'
import SignalMark from '../../components/ui/SignalMark'
import { useInView } from '../../hooks/useInView'
import { hoverLift } from '../../utils/motion'
import uaskLogo from '../../assets/brand/uask.logo.png'
import styles from './CtaSection.module.css'

export default function CtaSection() {
  const [ref, isInView] = useInView()

  return (
    <section className={`section ${styles.cta}`}>
      <div className={styles.markWrap} aria-hidden="true">
        <SignalMark size="lg" rings={3} />
      </div>
      <div className={`container ${styles.container}`}>
        <motion.div
          ref={ref}
          className={styles.inner}
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <img src={uaskLogo} alt="UASK" className={styles.logo} />

          <h2 className={styles.heading}>
            Ready to post your <em>first</em> ASK?
          </h2>
          <p className={styles.subtitle}>It takes a couple of minutes, and providers come to you.</p>

          <div className={styles.actions}>
            <motion.div initial="rest" whileHover="hover" whileTap={{ scale: 0.97 }} variants={hoverLift}>
              <Button as={Link} to="/signup" size="lg">
                Create ASK
              </Button>
            </motion.div>
            <Link to="/login" className={styles.loginLink}>
              Already have an account? Log in
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
