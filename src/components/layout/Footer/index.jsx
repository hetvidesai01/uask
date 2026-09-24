import { Link } from 'react-router-dom'
import uaskLogo from '../../../assets/brand/uask.logo.png'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.top}>
          <img src={uaskLogo} alt="UASK" className={styles.logoImg} />
          <p className={styles.tagline}>Post what you need. Let the offers come to you.</p>
        </div>

        <nav className={styles.links} aria-label="Footer">
          <Link to="/">Home</Link>
          <Link to="/login">Log in</Link>
          <Link to="/signup">Sign up</Link>
        </nav>

        <p className={styles.copyright}>© {new Date().getFullYear()} UASK. All rights reserved.</p>
      </div>
    </footer>
  )
}
