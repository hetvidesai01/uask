import { Link } from 'react-router-dom'
import Button from '../../ui/Button'
import styles from './Navbar.module.css'

export default function Navbar() {
  return (
    <header className={styles.navbar}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.logo}>
          UASK
        </Link>

        <nav className={styles.links} aria-label="Primary">
          <a href="/#how-it-works">How it works</a>
          <Link to="/app/discover">Browse ASKs</Link>
        </nav>

        <div className={styles.actions}>
          <Link to="/login" className={styles.loginLink}>
            Log in
          </Link>
          <Button as={Link} to="/signup" size="sm">
            Sign up
          </Button>
        </div>
      </div>
    </header>
  )
}
