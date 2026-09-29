import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import GlobalSearch from '../components/search/GlobalSearch'
import UpgradeTeaser from '../components/premium/UpgradeTeaser'
import PremiumDrawer from '../components/premium/PremiumDrawer'
import ProductTour from '../components/onboarding/ProductTour'
import uaskLogo from '../assets/brand/uask.logo.png'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { getNotifications } from '../services/notificationService'
import { getThreads } from '../services/messageService'
import { getSubscription, createCheckoutSession } from '../services/subscriptionService'
import { hoverLift } from '../utils/motion'
import styles from './AppLayout.module.css'

const BADGE_SPRING = { type: 'spring', stiffness: 500, damping: 22 }
const DOT_SPRING = { type: 'spring', stiffness: 420, damping: 28 }

// Primary nav is role-shaped, not a fixed list: Seekers post/manage
// ASKs so they get Create ASK; Providers discover/respond to ASKs so they
// get Discover ASKs instead. Discover ASKs stays reachable for Seekers
// too (route + global search are untouched) — it's just not a primary
// workflow item for that role. Full list is what the desktop sidebar
// shows; the mobile tab bar derives a shorter subset from it (see
// mobileNavItems below) since Connections/Settings stay one tap away in
// the existing account-menu dropdown on that surface.
const REQUESTER_NAV_ITEMS = [
  { to: '/', label: 'Home', icon: '🌐', end: true },
  { to: '/app/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/app/asks/new', label: 'Create ASK', icon: '➕' },
  { to: '/app/inbox', label: 'Inbox', icon: '📥' },
  { to: '/app/connections', label: 'Connections', icon: '🤝' },
  { to: '/app/profile', label: 'Profile', icon: '👤' },
  { to: '/app/settings', label: 'Settings', icon: '⚙️' },
]

const PROVIDER_NAV_ITEMS = [
  { to: '/', label: 'Home', icon: '🌐', end: true },
  { to: '/app/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/app/discover', label: 'Discover', icon: '🔍' },
  { to: '/app/inbox', label: 'Inbox', icon: '📥' },
  { to: '/app/connections', label: 'Connections', icon: '🤝' },
  { to: '/app/profile', label: 'Profile', icon: '👤' },
  { to: '/app/settings', label: 'Settings', icon: '⚙️' },
]

const MOBILE_HIDDEN_PATHS = new Set(['/app/connections', '/app/settings'])

const ROLE_LABELS = { seeker: 'Seeker', provider: 'Provider' }

function navLinkClass({ isActive }) {
  return [styles.navLink, isActive ? styles.active : ''].filter(Boolean).join(' ')
}

function tabLinkClass({ isActive }) {
  return [styles.tabLink, isActive ? styles.active : ''].filter(Boolean).join(' ')
}

export default function AppLayout() {
  const { user, activeRole, setActiveRole, logout } = useAuth()
  const { showToast } = useToast()
  const [unreadCount, setUnreadCount] = useState(0)
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [premiumOpen, setPremiumOpen] = useState(false)
  const desktopMenuRef = useRef(null)
  const mobileMenuRef = useRef(null)

  const firstName = user.name?.split(' ')[0] ?? user.name
  const hasBothRoles = (user.roles?.length ?? 0) > 1
  const isRequester = activeRole !== 'provider'
  const navItems = isRequester ? REQUESTER_NAV_ITEMS : PROVIDER_NAV_ITEMS
  // Profile stays out of the desktop sidebar's main list — it's reachable
  // only via the bottom-left profile trigger's dropdown (View profile),
  // to avoid showing it twice. The mobile tab bar keeps its own Profile
  // icon since that surface has no equivalent bottom-left trigger.
  const sidebarNavItems = navItems.filter((item) => item.to !== '/app/profile')
  const mobileNavItems = navItems.filter((item) => !MOBILE_HIDDEN_PATHS.has(item.to))

  // Inbox badge = unread notifications + unread messages across all
  // threads, derived from the existing service data (not hardcoded).
  useEffect(() => {
    let cancelled = false
    Promise.all([getNotifications(user.id), getThreads(user.id)]).then(([notifications, threads]) => {
      if (cancelled) return
      const unreadNotifications = notifications.filter((item) => !item.read).length
      const unreadMessages = threads.reduce((sum, thread) => sum + thread.unreadCount, 0)
      setUnreadCount(unreadNotifications + unreadMessages)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  useEffect(() => {
    let cancelled = false
    getSubscription(user.id).then((result) => {
      if (!cancelled) setSubscription(result)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  useEffect(() => {
    if (!desktopMenuOpen && !mobileMenuOpen) return

    function handlePointerDown(event) {
      if (desktopMenuRef.current && !desktopMenuRef.current.contains(event.target)) setDesktopMenuOpen(false)
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) setMobileMenuOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setDesktopMenuOpen(false)
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [desktopMenuOpen, mobileMenuOpen])

  function handleRoleSwitch(role) {
    if (role === activeRole) return
    setActiveRole(role)
    showToast(`Switched to ${ROLE_LABELS[role] ?? role} mode.`)
  }

  // Starts a mock checkout session — does NOT grant Premium. See
  // subscriptionService.createCheckoutSession for why: no payment gateway
  // is wired up yet, so the frontend must not change subscription state.
  async function handleCheckout(billingCycle) {
    return createCheckoutSession(user.id, billingCycle)
  }

  return (
    <div className={styles.shell}>
      <motion.aside
        className={styles.sidebar}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link to="/app/dashboard" className={styles.logo}>
          <img src={uaskLogo} alt="UASK" className={styles.logoImg} />
        </Link>

        {isRequester && (
          <motion.div initial="rest" whileHover="hover" whileTap={{ scale: 0.97 }} variants={hoverLift}>
            <Button as={Link} to="/app/asks/new" fullWidth className={styles.newAskButton}>
              + Create ASK
            </Button>
          </motion.div>
        )}

        <nav className={styles.nav} aria-label="Primary">
          {sidebarNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {({ isActive }) => (
                <>
                  <motion.span
                    className={styles.activeDot}
                    aria-hidden="true"
                    initial={false}
                    animate={{ scale: isActive ? 1 : 0.4, opacity: isActive ? 1 : 0 }}
                    transition={DOT_SPRING}
                  />
                  <span className={styles.icon} aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                  {item.to === '/app/inbox' && unreadCount > 0 && (
                    <motion.span
                      className={styles.navBadge}
                      aria-hidden="true"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={BADGE_SPRING}
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Compact account area, pinned to the bottom of the floating sidebar. */}
        <div className={styles.sidebarFooter} ref={desktopMenuRef}>
          <button
            type="button"
            className={styles.sidebarProfileTrigger}
            onClick={() => setDesktopMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={desktopMenuOpen}
          >
            <Avatar src={user.avatarUrl} name={user.name} size="sm" />
            <span className={styles.sidebarProfileInfo}>
              <span className={styles.sidebarProfileName}>{firstName}</span>
              {activeRole && (
                <span className={styles.sidebarProfileRole}>{ROLE_LABELS[activeRole] ?? activeRole}</span>
              )}
            </span>
            <span className={styles.chevron} aria-hidden="true">
              ▾
            </span>
          </button>

          {desktopMenuOpen && (
            <div className={[styles.dropdown, styles.sidebarDropdown].join(' ')} role="menu">
              <Link
                to="/app/profile"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => setDesktopMenuOpen(false)}
              >
                View profile
              </Link>
              <Link
                to="/app/connections"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => setDesktopMenuOpen(false)}
              >
                Connections
              </Link>
              <Link
                to="/app/settings"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => setDesktopMenuOpen(false)}
              >
                Settings
              </Link>
              <button
                type="button"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => {
                  setDesktopMenuOpen(false)
                  logout()
                }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Mobile top bar (logo + account menu, scrolls with the page) */}
      <header className={styles.topbar}>
        <Link to="/app/dashboard" className={styles.logo}>
          <img src={uaskLogo} alt="UASK" className={styles.logoImg} />
        </Link>
        <div className={styles.topbarActions}>
          <Link to="/help" className={styles.helpButton} aria-label="Help">
            <span aria-hidden="true">❓</span>
          </Link>

          <div className={styles.mobileAccountMenu} ref={mobileMenuRef}>
            <button
              type="button"
              className={styles.topbarAvatar}
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={mobileMenuOpen}
              aria-label="Your account"
            >
              <Avatar src={user.avatarUrl} name={user.name} size="sm" />
            </button>

            {mobileMenuOpen && (
              <div className={styles.dropdown} role="menu">
                <Link
                  to="/app/profile"
                  className={styles.dropdownItem}
                  role="menuitem"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  View profile
                </Link>
                <Link
                  to="/app/connections"
                  className={styles.dropdownItem}
                  role="menuitem"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Connections
                </Link>
                <Link
                  to="/app/settings"
                  className={styles.dropdownItem}
                  role="menuitem"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Settings
                </Link>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  role="menuitem"
                  onClick={() => {
                    setMobileMenuOpen(false)
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

      {/* Desktop-only content top bar: search, role switch, notifications */}
      <header className={styles.appTopBar}>
        <GlobalSearch />

        <div className={styles.topBarActions}>
          {hasBothRoles && (
            <div className={styles.roleIndicator} role="group" aria-label="Switch active role">
              {user.roles.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={[styles.rolePill, activeRole === role ? styles.roleActive : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={activeRole === role}
                  onClick={() => handleRoleSwitch(role)}
                >
                  {ROLE_LABELS[role] ?? role}
                </button>
              ))}
            </div>
          )}

          <Link to="/help" className={styles.helpButton} aria-label="Help">
            <span aria-hidden="true">❓</span>
          </Link>

          <Link to="/app/inbox?tab=notifications" className={styles.bellButton} aria-label="Notifications">
            <span aria-hidden="true">🔔</span>
            {unreadCount > 0 && (
              <motion.span
                className={styles.bellBadge}
                aria-hidden="true"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={BADGE_SPRING}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      {subscription && subscription.plan !== 'premium' && (
        <UpgradeTeaser onOpen={() => setPremiumOpen(true)} />
      )}

      <PremiumDrawer
        open={premiumOpen}
        onClose={() => setPremiumOpen(false)}
        plan={subscription?.plan ?? 'basic'}
        onCheckout={handleCheckout}
      />

      <ProductTour />

      <nav className={styles.tabBar} aria-label="Primary">
        {mobileNavItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={tabLinkClass}>
            <span className={styles.tabIconWrap}>
              <span aria-hidden="true">{item.icon}</span>
              {item.to === '/app/inbox' && unreadCount > 0 && (
                <motion.span
                  className={styles.tabBadge}
                  aria-hidden="true"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={BADGE_SPRING}
                />
              )}
            </span>
            <span className={styles.tabLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {isRequester && (
        <Link to="/app/asks/new" className={styles.fab} aria-label="Create ASK">
          <span aria-hidden="true">+</span>
        </Link>
      )}
    </div>
  )
}
