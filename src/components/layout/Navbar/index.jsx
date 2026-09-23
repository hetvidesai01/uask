import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Button from '../../ui/Button'
import styles from './Navbar.module.css'

export default function Navbar() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!isLanding) return
    const handleScroll = () => setScrolled(window.scrollY > 24)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isLanding])

  const classes = [
    styles.navbar,
    isLanding ? styles.overHero : styles.solid,
    isLanding && scrolled ? styles.scrolled : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <header className={classes}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.logo}>
          UASK
          <span className={styles.logoDot} aria-hidden="true" />
        </Link>

        <nav className={styles.links} aria-label="Primary">
          <a href="/#how-it-works">How it works</a>
          <Link to="/app/discover">Discover ASKs</Link>
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
