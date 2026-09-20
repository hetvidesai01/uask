import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import { useAuth } from '../../hooks/useAuth'
import { isRequired, isValidEmail, minLength } from '../../utils/validators'
import styles from './Login.module.css'

export default function Login() {
  const { isAuthenticated, login } = useAuth()
  const location = useLocation()

  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Single source of truth for where a logged-in user should land — used
  // both for "already logged in" visits and right after a fresh login.
  const redirectTo = location.state?.from?.pathname ?? '/app/dashboard'

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />
  }

  const handleChange = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const validate = () => {
    const nextErrors = {}

    if (!isRequired(values.email)) {
      nextErrors.email = 'Enter your email.'
    } else if (!isValidEmail(values.email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (!isRequired(values.password)) {
      nextErrors.password = 'Enter your password.'
    } else if (!minLength(values.password, 6)) {
      nextErrors.password = 'Password must be at least 6 characters.'
    }

    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    await login({ email: values.email })
    // No imperative navigate here — becoming authenticated flips the
    // `isAuthenticated` check above on the next render, which redirects.
  }

  return (
    <div className={`section container ${styles.page}`}>
      <Card padding="lg" className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Log in</h1>
          <p className={styles.subtitle}>Welcome back — pick up where you left off.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={handleChange('email')}
            error={errors.email}
            placeholder="you@example.com"
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={handleChange('password')}
            error={errors.password}
            placeholder="••••••••"
          />

          <Button type="submit" fullWidth loading={submitting}>
            Log in
          </Button>
        </form>

        <p className={styles.footer}>
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>
      </Card>
    </div>
  )
}
