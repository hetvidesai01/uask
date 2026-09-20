import { useState } from 'react'

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })

  const setStoredValue = (next) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      try {
        if (resolved === null || resolved === undefined) {
          window.localStorage.removeItem(key)
        } else {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        }
      } catch {
        // Storage unavailable (private mode, quota, etc.) — state still
        // updates for this session, it just won't persist across reloads.
      }
      return resolved
    })
  }

  return [value, setStoredValue]
}
