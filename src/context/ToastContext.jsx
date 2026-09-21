import { createContext, useCallback, useState } from 'react'

export const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, variant = 'success') => {
    setToast({ message, variant, id: Date.now() })
  }, [])

  const hideToast = useCallback(() => setToast(null), [])

  return (
    <ToastContext.Provider value={{ toast, showToast, hideToast }}>
      {children}
    </ToastContext.Provider>
  )
}
