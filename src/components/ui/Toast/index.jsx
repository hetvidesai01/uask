import { useEffect } from 'react'
import { useToast } from '../../../hooks/useToast'
import styles from './Toast.module.css'

export default function Toast() {
  const { toast, hideToast } = useToast()

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(hideToast, 3500)
    return () => clearTimeout(timer)
  }, [toast, hideToast])

  if (!toast) return null

  const classes = [styles.toast, styles[toast.variant] || ''].filter(Boolean).join(' ')

  return (
    <div className={classes} role="status" aria-live="polite">
      <span>{toast.message}</span>
      <button className={styles.close} onClick={hideToast} aria-label="Dismiss notification">
        ✕
      </button>
    </div>
  )
}
