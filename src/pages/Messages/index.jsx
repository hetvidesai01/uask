import { Link, Outlet } from 'react-router-dom'

export default function Messages() {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <nav className="stack">
        <h1>Messages</h1>
        <Link to="/app/messages/1">Thread 1</Link>
        <Link to="/app/messages/2">Thread 2</Link>
      </nav>
      <div className="stack">
        <Outlet />
      </div>
    </div>
  )
}
