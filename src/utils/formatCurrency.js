export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatBudgetRange(min, max, currency = 'USD') {
  if (min === max) return formatCurrency(min, currency)
  return `${formatCurrency(min, currency)}–${formatCurrency(max, currency)}`
}
