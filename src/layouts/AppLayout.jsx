import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { getNotifications } from '../services/notificationService'
import styles from './AppLayout.module.css'

const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/app/discover', label: 'Discover', icon: '🔍' },
  { to: '/app/messages', label: 'Messages', icon: '💬' },
  { to: '/app/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/app/profile', label: 'Profile', icon: '👤' },
]

const ROLE_ORDER = ['seeker', 'provider']

function navLinkClass({ isActive }) {
  return [styles.navLink, isActive ? styles.active : ''].filter(Boolean).join(' ')
}

function tabLinkClass({ isActive }) {
  return [styles.tabLink, isActive ? styles.active : ''].filter(Boolean).join(' ')
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    getNotifications(user.id).then((list) => {
      if (cancelled) return
      setUnreadCount(list.filter((item) => !item.read).length)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  function handleSearchSubmit(event) {
    event.preventDefault()
    setSearch('')
    navigate('/app/discover')
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/app/dashboard" className={styles.logo}>
          UASK
          <span className={styles.logoDot} aria-hidden="true" />
        </Link>

        <Button as={Link} to="/app/asks/new" fullWidth className={styles.newAskButton}>
          + New ASK
        </Button>

        <nav className={styles.nav} aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              <span className={styles.rail} aria-hidden="true" />
              <span className={styles.icon} aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
              {item.to === '/app/notifications' && unreadCount > 0 && (
                <span className={styles.navBadge} aria-hidden="true">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile top bar (logo + avatar, scrolls with the page) */}
      <header className={styles.topbar}>
        <Link to="/app/dashboard" className={styles.logo}>
          UASK
          <span className={styles.logoDot} aria-hidden="true" />
        </Link>
        <Link to="/app/profile" className={styles.topbarAvatar} aria-label="Your profile">
          <Avatar src={user.avatarUrl} name={user.name} size="sm" />
        </Link>
      </header>

      {/* Desktop-only content top bar: search, role indicator, notifications, account menu */}
      <header className={styles.appTopBar}>
        <form className={styles.search} role="search" onSubmit={handleSearchSubmit}>
          <span className={styles.searchIcon} aria-hidden="true">
            🔍
          </span>
          <label htmlFor="app-search" className="sr-only">
            Search ASKs
          </label>
          <input
            id="app-search"
            type="search"
            className={styles.searchInput}
            placeholder="Search ASKs"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </form>

        <div className={styles.topBarActions}>
          <div className={styles.roleIndicator} title="Your account roles">
            {ROLE_ORDER.map((role) => (
              <span
                key={role}
                className={[styles.rolePill, user.roles?.includes(role) ? styles.roleActive : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {role}
              </span>
            ))}
          </div>

          <Link to="/app/notifications" className={styles.bellButton} aria-label="Notifications">
            <span aria-hidden="true">🔔</span>
            {unreadCount > 0 && (
              <span className={styles.bellBadge} aria-hidden="true">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <div className={styles.accountMenu} ref={menuRef}>
            <button
              type="button"
              className={styles.accountTrigger}
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <Avatar src={user.avatarUrl} name={user.name} size="sm" />
              <span className={styles.accountName}>{user.name}</span>
              <span className={styles.chevron} aria-hidden="true">
                ▾
              </span>
            </button>

            {menuOpen && (
              <div className={styles.dropdown} role="menu">
                <Link
                  to="/app/profile"
                  className={styles.dropdownItem}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  View profile
                </Link>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    logout()
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      <nav className={styles.tabBar} aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={tabLinkClass}>
            <span className={styles.tabIconWrap}>
              <span aria-hidden="true">{item.icon}</span>
              {item.to === '/app/notifications' && unreadCount > 0 && (
                <span className={styles.tabBadge} aria-hidden="true" />
              )}
            </span>
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
