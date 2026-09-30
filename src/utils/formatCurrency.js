// Single source of truth for currency behavior. INR is the default (UASK is
// India-based); USD stays available anywhere a currency can be chosen.
export const DEFAULT_CURRENCY = 'INR'

export const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR (₹)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
]

export function formatCurrency(amount, currency) {
  const code = currency || DEFAULT_CURRENCY
  return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatBudgetRange(min, max, currency) {
  if (min === max) return formatCurrency(min, currency)
  return `${formatCurrency(min, currency)}–${formatCurrency(max, currency)}`
}
