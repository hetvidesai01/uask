import { useEffect, useState } from 'react'
import { isProviderSaved, saveProvider, unsaveProvider } from '../../../services/savedProvidersService'
import styles from './SaveButton.module.css'

// A lightweight bookmark-style "Save" for a provider profile — not a
// follow/like, no counts shown anywhere, no feed. Just a personal
// shortlist the current user can build up and revisit.
export default function SaveButton({ currentUserId, providerId }) {
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    isProviderSaved(currentUserId, providerId).then((result) => {
      if (!cancelled) setSaved(result)
    })
    return () => {
      cancelled = true
    }
  }, [currentUserId, providerId])

  async function toggle() {
    setBusy(true)
    try {
      if (saved) {
        await unsaveProvider(currentUserId, providerId)
        setSaved(false)
      } else {
        await saveProvider(currentUserId, providerId)
        setSaved(true)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={[styles.button, saved ? styles.saved : ''].filter(Boolean).join(' ')}
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
    >
      <span aria-hidden="true">{saved ? '🔖' : '🏷️'}</span>
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}
