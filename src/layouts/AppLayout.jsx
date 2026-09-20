import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AppLayout() {
  const { logout } = useAuth()

  return (
    <div className="stack">
      <header className="row container" style={{ paddingBlock: 'var(--sp-4)' }}>
        <strong style={{ fontFamily: 'var(--font-display)' }}>UASK</strong>
        <nav className="row">
          <Link to="/app/dashboard">Dashboard</Link>
          <Link to="/app/asks/new">New ASK</Link>
          <Link to="/app/discover">Discover</Link>
          <Link to="/app/messages">Messages</Link>
          <Link to="/app/notifications">Notifications</Link>
          <Link to="/app/profile">Profile</Link>
        </nav>
        <button onClick={logout}>Log out</button>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  )
}
