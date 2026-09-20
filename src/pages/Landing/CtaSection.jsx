import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { useInView } from '../../hooks/useInView'
import styles from './CtaSection.module.css'

export default function CtaSection() {
  const [ref, isInView] = useInView()

  return (
    <section className={`section ${styles.cta}`}>
      <div className="container">
        <div ref={ref} className={`reveal ${isInView ? 'isVisible' : ''} ${styles.inner}`}>
          <h2 className={styles.heading}>Ready to post your first ASK?</h2>
          <p className={styles.subtitle}>
            It takes a couple of minutes, and providers come to you.
          </p>
          <div className={styles.actions}>
            <Button as={Link} to="/signup" size="lg" inverted>
              Get started — it's free
            </Button>
            <Link to="/login" className={styles.loginLink}>
              Already have an account? Log in
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
