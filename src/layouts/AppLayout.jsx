import { Link, NavLink, Outlet } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import styles from './AppLayout.module.css'

const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/app/discover', label: 'Discover', icon: '🔍' },
  { to: '/app/messages', label: 'Messages', icon: '💬' },
  { to: '/app/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/app/profile', label: 'Profile', icon: '👤' },
]

function navLinkClass({ isActive }) {
  return [styles.navLink, isActive ? styles.active : ''].filter(Boolean).join(' ')
}

function tabLinkClass({ isActive }) {
  return [styles.tabLink, isActive ? styles.active : ''].filter(Boolean).join(' ')
}

export default function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/app/dashboard" className={styles.logo}>
          UASK
        </Link>

        <Button as={Link} to="/app/asks/new" fullWidth>
          + New ASK
        </Button>

        <nav className={styles.nav} aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              <span className={styles.icon} aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.account}>
          <Link to="/app/profile" className={styles.accountLink}>
            <Avatar src={user.avatarUrl} name={user.name} size="sm" />
            <span className={styles.accountName}>{user.name}</span>
          </Link>
          <button type="button" className={styles.logoutButton} onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <header className={styles.topbar}>
        <Link to="/app/dashboard" className={styles.logo}>
          UASK
        </Link>
        <Link to="/app/profile" className={styles.topbarAvatar} aria-label="Your profile">
          <Avatar src={user.avatarUrl} name={user.name} size="sm" />
        </Link>
      </header>

      <main className={styles.main}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      <nav className={styles.tabBar} aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={tabLinkClass}>
            <span aria-hidden="true">{item.icon}</span>
            <span className={styles.tabLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <Link to="/app/asks/new" className={styles.fab} aria-label="Post a new ASK">
        <span aria-hidden="true">+</span>
      </Link>
    </div>
  )
}
