import { createContext } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import * as authService from '../services/authService'

export const AuthContext = createContext(null)

const STORAGE_KEY = 'uask.auth.user'

export function AuthProvider({ children }) {
  const [user, setUser] = useLocalStorage(STORAGE_KEY, null)

  const login = async ({ email }) => {
    const loggedInUser = await authService.login({ email })
    setUser(loggedInUser)
    return loggedInUser
  }

  const signup = async ({ name, email, roles }) => {
    const newUser = await authService.signup({ name, email, roles })
    setUser(newUser)
    return newUser
  }

  const logout = () => setUser(null)

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
