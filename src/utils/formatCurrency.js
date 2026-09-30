// Single source of truth for currency behavior.
//
// Data model: mock monetary values are stored in INR (the canonical currency,
// UASK is India-based) or in whatever currency a user picked when creating
// an ASK/offer — stored values are never rewritten. Display is converted
// into the user's Default Currency preference (Settings) at render time
// using the static demo rates below. No live FX, no network.
export const CANONICAL_CURRENCY = 'INR'
export const DEFAULT_CURRENCY = 'INR'

// Static demo exchange rates: units of each currency per 1 INR.
// The ONLY place conversion numbers live.
export const EXCHANGE_RATES = {
  INR: 1,
  USD: 0.012, // ≈ ₹83.3 per $1
  EUR: 0.011, // ≈ ₹90.9 per €1
  GBP: 0.0095, // ≈ ₹105 per £1 (only for legacy form entries)
}

// Currency choices when entering a price in a form.
export const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR (₹)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
]

// Choices for the Default Currency preference in Settings.
export const PREFERENCE_CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
]

// ── Preference (same key namespace + JSON format as the other Settings) ──
export const CURRENCY_STORAGE_KEY = 'uask.settings.currency'
const CHANGE_EVENT = 'uask:currency-change'

function isSupported(code) {
  return PREFERENCE_CURRENCY_OPTIONS.some((option) => option.value === code)
}

let cachedPreference = null

export function getPreferredCurrency() {
  if (cachedPreference) return cachedPreference
  try {
    const stored = JSON.parse(window.localStorage.getItem(CURRENCY_STORAGE_KEY))
    cachedPreference = isSupported(stored) ? stored : DEFAULT_CURRENCY
  } catch {
    cachedPreference = DEFAULT_CURRENCY
  }
  return cachedPreference
}

export function setPreferredCurrency(code) {
  if (!isSupported(code)) return
  cachedPreference = code
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(code))
  } catch {
    // Storage unavailable — the preference still applies for this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeToCurrencyPreference(callback) {
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

// ── Conversion + formatting ──────────────────────────────────────────────
export function convertCurrency(amount, from = CANONICAL_CURRENCY, to = getPreferredCurrency()) {
  const fromRate = EXCHANGE_RATES[from] ?? 1
  const toRate = EXCHANGE_RATES[to] ?? 1
  return (Number(amount) / fromRate) * toRate
}

// Formats an amount exactly as given, in the given currency (no conversion).
// Used where the user is looking at what they just typed (review steps).
export function formatCurrencyAs(amount, currency) {
  const code = currency || DEFAULT_CURRENCY
  return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Formats a stored amount (in `currency`, INR if omitted) in the user's
// Default Currency, converting the number — not just swapping the symbol.
export function formatCurrency(amount, currency) {
  const target = getPreferredCurrency()
  return formatCurrencyAs(convertCurrency(amount, currency || CANONICAL_CURRENCY, target), target)
}

export function formatBudgetRange(min, max, currency) {
  if (min === max) return formatCurrency(min, currency)
  return `${formatCurrency(min, currency)}–${formatCurrency(max, currency)}`
}

// Sample text for a price input placeholder: an INR reference amount shown
// in the currency the form is currently using.
export function formatSampleAmount(inrAmount, currency) {
  const code = currency || getPreferredCurrency()
  return formatCurrencyAs(Math.round(convertCurrency(inrAmount, CANONICAL_CURRENCY, code)), code)
}
