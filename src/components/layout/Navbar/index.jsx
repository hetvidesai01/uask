import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SNAPPY_SPRING } from '../../../utils/motion'
import Button from '../../ui/Button'
import uaskLogo from '../../../assets/brand/uask.logo.png'
import styles from './Navbar.module.css'

// Every public page shares the Home page's header treatment (large logo,
// large links, transparent bar that frosts on scroll).
const HOME_STYLE_PATHS = new Set(['/help', '/about', '/collaborators', '/login', '/signup'])

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/help', label: 'Help' },
  { to: '/app/discover', label: 'Discover ASKs' },
  { to: '/collaborators', label: 'Collaborators' },
  { to: '/about', label: 'About Us' },
]

function navLinkClass({ isActive }) {
  return isActive ? styles.active : undefined
}

export default function Navbar() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'
  const matchesHome = isLanding || HOME_STYLE_PATHS.has(pathname)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!matchesHome) return
    const handleScroll = () => setScrolled(window.scrollY > 24)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [matchesHome])

  const classes = [
    styles.navbar,
    isLanding ? styles.overHero : matchesHome ? styles.plain : styles.solid,
    matchesHome && scrolled ? styles.scrolled : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <header className={classes}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.logo}>
          <img
            src={uaskLogo}
            alt="UASK"
            className={[styles.logoImg, matchesHome ? styles.logoImgLanding : ''].filter(Boolean).join(' ')}
          />
        </Link>

        <nav
          className={[styles.links, matchesHome ? styles.linksLanding : ''].filter(Boolean).join(' ')}
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="public-nav-underline"
                      className={styles.activeUnderline}
                      transition={SNAPPY_SPRING}
                      aria-hidden="true"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link to="/login" className={styles.loginLink}>
            Log in
          </Link>
          <Button as={Link} to="/signup" size="sm" className={styles.signupButton}>
            Sign up
          </Button>
        </div>
      </div>
    </header>
  )
}
