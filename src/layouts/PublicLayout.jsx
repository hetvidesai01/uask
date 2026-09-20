import { Link, Outlet } from 'react-router-dom'

export default function PublicLayout() {
  return (
    <div className="stack">
      <header className="row container" style={{ paddingBlock: 'var(--sp-4)' }}>
        <strong style={{ fontFamily: 'var(--font-display)' }}>UASK</strong>
        <nav className="row">
          <Link to="/">Home</Link>
          <Link to="/login">Log in</Link>
          <Link to="/signup">Sign up</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
