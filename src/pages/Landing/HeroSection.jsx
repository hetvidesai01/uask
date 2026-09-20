import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import styles from './HeroSection.module.css'

export default function HeroSection() {
  return (
    <section className={`section ${styles.hero}`}>
      <div className={`container ${styles.inner}`}>
        <span className={`${styles.kicker} ${styles.enter}`} style={{ animationDelay: '0ms' }}>
          A reverse marketplace
        </span>

        <h1 className={styles.title}>Ask for what you need. Compare what shows up.</h1>

        <p className={`${styles.subtitle} ${styles.enter}`} style={{ animationDelay: '80ms' }}>
          Post your ASK once. Qualified providers send you offers — no endless searching,
          no cold outreach.
        </p>

        <div className={`${styles.actions} ${styles.enter}`} style={{ animationDelay: '160ms' }}>
          <Button as={Link} to="/signup" size="lg">
            Post an ASK
          </Button>
          <Button as={Link} to="/app/discover" variant="secondary" size="lg">
            Respond to ASKs
          </Button>
        </div>
      </div>
    </section>
  )
}
