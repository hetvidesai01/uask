import { Link } from 'react-router-dom'
import styles from './PublicFooter.module.css'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/help', label: 'Help' },
  { to: '/app/discover', label: 'Discover ASKs' },
  { to: '/collaborators', label: 'Collaborators' },
  { to: '/about', label: 'About Us' },
  { to: '/login', label: 'Login' },
  { to: '/signup', label: 'Signup' },
]

const LEGAL_LINKS = [
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/about#contact', label: 'Contact' },
]

export default function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <nav className={styles.links} aria-label="Footer">
          {NAV_LINKS.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.legal}>
          <span>© UASK</span>
          {LEGAL_LINKS.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
