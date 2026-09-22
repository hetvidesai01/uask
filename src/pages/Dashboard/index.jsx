import { NavLink, Outlet } from 'react-router-dom'
import styles from './Dashboard.module.css'

const SWITCH_ITEMS = [
  { to: '/app/dashboard', label: 'ASKs & Offers', end: true },
  { to: '/app/dashboard/payments', label: 'Payments & Milestones', end: false },
]

function switchLinkClass({ isActive }) {
  return [styles.switchLink, isActive ? styles.active : ''].filter(Boolean).join(' ')
}

export default function Dashboard() {
  return (
    <div className={styles.page}>
      <nav className={styles.switcher} aria-label="Dashboard area">
        {SWITCH_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={switchLinkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
