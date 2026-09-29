// A lightweight bookmark-style "Save" for provider profiles — explicitly
// not a follow/like/social feature. Persisted per-user in localStorage,
// same lightweight pattern as other small preference services in this app.
const STORAGE_PREFIX = 'uask.savedProviders.'

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

function readSaved(userId) {
  try {
    const stored = window.localStorage.getItem(STORAGE_PREFIX + userId)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function writeSaved(userId, providerIds) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(providerIds))
  } catch {
    // Storage unavailable — the choice still applies for this session.
  }
}

export async function isProviderSaved(userId, providerId) {
  await delay()
  return readSaved(userId).includes(providerId)
}

export async function getSavedProviderIds(userId) {
  await delay()
  return readSaved(userId)
}

export async function saveProvider(userId, providerId) {
  await delay()
  const current = readSaved(userId)
  const next = current.includes(providerId) ? current : [...current, providerId]
  writeSaved(userId, next)
  return next
}

export async function unsaveProvider(userId, providerId) {
  await delay()
  const next = readSaved(userId).filter((id) => id !== providerId)
  writeSaved(userId, next)
  return next
}
