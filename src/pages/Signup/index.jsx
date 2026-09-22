import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { isRequired, isValidEmail, minLength } from '../../utils/validators'
import styles from './Signup.module.css'

const ROLE_OPTIONS = [
  { value: '', label: 'Choose one' },
  { value: 'seeker', label: 'I need something (seeker)' },
  { value: 'provider', label: 'I offer services (provider)' },
  { value: 'both', label: 'Both' },
]

function rolesFromSelection(selection) {
  if (selection === 'both') return ['seeker', 'provider']
  return [selection]
}

export default function Signup() {
  const { isAuthenticated, signup } = useAuth()
  const { showToast } = useToast()

  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />
  }

  const handleChange = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const validate = () => {
    const nextErrors = {}

    if (!isRequired(values.name)) {
      nextErrors.name = 'Enter your name.'
    }

    if (!isRequired(values.email)) {
      nextErrors.email = 'Enter your email.'
    } else if (!isValidEmail(values.email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (!isRequired(values.password)) {
      nextErrors.password = 'Choose a password.'
    } else if (!minLength(values.password, 6)) {
      nextErrors.password = 'Password must be at least 6 characters.'
    }

    if (!isRequired(values.confirmPassword)) {
      nextErrors.confirmPassword = 'Confirm your password.'
    } else if (values.confirmPassword !== values.password) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    if (!isRequired(values.role)) {
      nextErrors.role = 'Choose how you plan to use UASK.'
    }

    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await signup({
        name: values.name.trim(),
        email: values.email,
        roles: rolesFromSelection(values.role),
      })
      // No imperative navigate here — becoming authenticated flips the
      // `isAuthenticated` check above on the next render, which redirects.
    } catch {
      showToast('Something went wrong creating your account. Please try again.', 'error')
      setSubmitting(false)
    }
  }

  return (
    <div className={`section container ${styles.page}`}>
      <Card padding="lg" className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.subtitle}>Post an ASK or start responding to them — takes a minute.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            label="Name"
            autoComplete="name"
            value={values.name}
            onChange={handleChange('name')}
            error={errors.name}
            placeholder="Your name"
          />

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={handleChange('email')}
            error={errors.email}
            placeholder="you@example.com"
          />

          <div className={styles.row}>
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={handleChange('password')}
              error={errors.password}
              placeholder="••••••••"
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={handleChange('confirmPassword')}
              error={errors.confirmPassword}
              placeholder="••••••••"
            />
          </div>

          <Select
            label="I'm signing up as"
            options={ROLE_OPTIONS}
            value={values.role}
            onChange={handleChange('role')}
            error={errors.role}
          />

          <Button type="submit" fullWidth loading={submitting}>
            Create account
          </Button>
        </form>

        <p className={styles.footer}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </Card>
    </div>
  )
}
