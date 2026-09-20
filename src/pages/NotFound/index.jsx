import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container stack">
      <h1>404 — Page not found</h1>
      <Link to="/">Back home</Link>
    </div>
  )
}
