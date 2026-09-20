import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function Login() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) {
    return <Navigate to="/app" replace />
  }

  const handleMockLogin = () => {
    login()
    navigate('/app')
  }

  return (
    <div className="container stack">
      <h1>Login</h1>
      <button onClick={handleMockLogin}>Mock log in</button>
    </div>
  )
}
