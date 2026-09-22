import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../../components/ui/Button'
import GradientMesh from '../../components/ui/GradientMesh'
import { useInView } from '../../hooks/useInView'
import styles from './CtaSection.module.css'

export default function CtaSection() {
  const [ref, isInView] = useInView()

  return (
    <section className={`section ${styles.cta}`}>
      <GradientMesh />
      <div className={`container ${styles.container}`}>
        <motion.div
          ref={ref}
          className={styles.inner}
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <h2 className={styles.heading}>
            Ready to post your <em>first</em> ASK?
          </h2>
          <p className={styles.subtitle}>It takes a couple of minutes, and providers come to you.</p>
          <div className={styles.actions}>
            <Button as={Link} to="/signup" size="lg" inverted>
              Get started — it's free
            </Button>
            <Link to="/login" className={styles.loginLink}>
              Already have an account? Log in
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
