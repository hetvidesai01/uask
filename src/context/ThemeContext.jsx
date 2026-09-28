import { createContext, useEffect, useState } from 'react'

export const ThemeContext = createContext(null)

const STORAGE_KEY = 'uask.theme.preference'
const VALID_PREFERENCES = ['light', 'dark', 'system']

function readStoredPreference() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return VALID_PREFERENCES.includes(stored) ? stored : 'light'
  } catch {
    return 'light'
  }
}

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function resolve(preference) {
  return preference === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : preference
}

// Appearance is 'light' | 'dark' | 'system' (the user's stored preference,
// set from Settings). Light stays the default UASK experience. The actual
// applied theme is always 'light' or 'dark' — resolved here and written to
// <html data-theme> — which is what tokens.css's dark override selector
// keys off of.
export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readStoredPreference)
  const [resolvedTheme, setResolvedTheme] = useState(() => resolve(preference))

  useEffect(() => {
    setResolvedTheme(resolve(preference))

    if (preference !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => setResolvedTheme(resolve('system'))
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [preference])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  function setPreference(next) {
    if (!VALID_PREFERENCES.includes(next)) return
    setPreferenceState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable — the choice still applies for this session.
    }
  }

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}
