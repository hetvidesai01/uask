import { createContext } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

export const AuthContext = createContext(null)

const STORAGE_KEY = 'uask.auth.user'

function nameFromEmail(email) {
  const [handle] = email.split('@')
  return handle.charAt(0).toUpperCase() + handle.slice(1)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useLocalStorage(STORAGE_KEY, null)

  // Mock login: no backend, so "authenticating" just means finding or
  // fabricating a user record for the email that was typed in. If it's the
  // same email as whoever is already stored, keep their existing profile
  // (name/roles) instead of overwriting it.
  const login = ({ email }) => {
    setUser((current) => {
      if (current && current.email.toLowerCase() === email.toLowerCase()) {
        return current
      }
      return {
        id: crypto.randomUUID(),
        name: nameFromEmail(email),
        email,
        roles: ['seeker'],
        joinedAt: new Date().toISOString(),
      }
    })
  }

  const signup = ({ name, email, roles }) => {
    setUser({
      id: crypto.randomUUID(),
      name,
      email,
      roles,
      joinedAt: new Date().toISOString(),
    })
  }

  const logout = () => setUser(null)

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
