import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { resetOnboarding } from '../../utils/onboarding'
import styles from './ProductTourCallout.module.css'

export default function ProductTourCallout() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  function handleRestart() {
    resetOnboarding(user.id)
    navigate('/app/dashboard')
  }

  return (
    <section className="section">
      <div className="container">
        <div className={styles.callout}>
          <div>
            <span className={styles.kicker}>Guided tour</span>
            <h2 className={styles.heading}>New to the app shell?</h2>
            <p className={styles.copy}>
              Replay the short walkthrough of Discover, Create ASK, Inbox, Dashboard and Profile — it opens the
              moment you land back in the app.
            </p>
          </div>

          {isAuthenticated ? (
            <Button onClick={handleRestart}>Restart Product Tour</Button>
          ) : (
            <div className={styles.loggedOut}>
              <p className={styles.loggedOutNote}>Log in to take the guided product tour.</p>
              <Button as={Link} to="/login" variant="secondary">
                Log in
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
