import { createContext, useEffect, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import * as authService from '../services/authService'

export const AuthContext = createContext(null)

const STORAGE_KEY = 'uask.auth.user'
const ROLE_KEY_PREFIX = 'uask.activeRole.'

// The role a user is currently "acting as" (Seeker vs Provider) when their
// account supports both. Persisted per-user so it survives a reload, same
// pattern as every other localStorage-backed piece of state in this app.
function readActiveRole(user) {
  if (!user) return null
  try {
    const stored = window.localStorage.getItem(ROLE_KEY_PREFIX + user.id)
    if (stored && user.roles?.includes(stored)) return stored
  } catch {
    // Storage unavailable — fall through to the default below.
  }
  return user.roles?.[0] ?? null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useLocalStorage(STORAGE_KEY, null)
  const [activeRole, setActiveRoleState] = useState(() => readActiveRole(user))

  useEffect(() => {
    setActiveRoleState(readActiveRole(user))
    // Only the identity of the logged-in user should reset the active role —
    // not every field update on the same user (e.g. a profile edit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const setActiveRole = (role) => {
    if (!user || !user.roles?.includes(role)) return
    setActiveRoleState(role)
    try {
      window.localStorage.setItem(ROLE_KEY_PREFIX + user.id, role)
    } catch {
      // Storage unavailable — the choice still applies for this session.
    }
  }

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

  const updateProfile = async (data) => {
    const updated = await authService.updateUser(user.id, data)
    setUser(updated)
    return updated
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        activeRole,
        setActiveRole,
        login,
        signup,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
