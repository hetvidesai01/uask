export function isRequired(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value)
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function minLength(value, length) {
  return typeof value === 'string' && value.trim().length >= length
}

// Mirrors the backend's signup rule exactly: at least 8 characters, at least
// one letter, at least one digit.
export function isStrongPassword(value) {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    /[a-zA-Z]/.test(value) &&
    /\d/.test(value)
  )
}

export function isPositiveNumber(value) {
  const num = Number(value)
  return value !== '' && !Number.isNaN(num) && num > 0
}
