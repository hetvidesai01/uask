const UNITS = [
  { limit: 60, divisor: 1, unit: 'second' },
  { limit: 3600, divisor: 60, unit: 'minute' },
  { limit: 86400, divisor: 3600, unit: 'hour' },
  { limit: 604800, divisor: 86400, unit: 'day' },
  { limit: 2629800, divisor: 604800, unit: 'week' },
  { limit: 31557600, divisor: 2629800, unit: 'month' },
]

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function formatRelativeDate(isoDate) {
  const seconds = (Date.now() - new Date(isoDate).getTime()) / 1000
  if (seconds < 60) return 'just now'

  const unit = UNITS.find((u) => seconds < u.limit)
  if (!unit) return rtf.format(-Math.round(seconds / 31557600), 'year')

  return rtf.format(-Math.round(seconds / unit.divisor), unit.unit)
}

const dtf = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function formatAbsoluteDate(isoDate) {
  return dtf.format(new Date(isoDate))
}
