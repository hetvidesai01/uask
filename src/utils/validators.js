export function isRequired(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value)
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function minLength(value, length) {
  return typeof value === 'string' && value.trim().length >= length
}
