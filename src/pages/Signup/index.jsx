import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import AuthLayout from '../../components/auth/AuthLayout'
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
  const [acceptedTerms, setAcceptedTerms] = useState(false)
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
      nextErrors.role = 'Tell us how you plan to use UASK.'
    }

    if (!acceptedTerms) {
      nextErrors.terms = 'You must agree to the Terms & Conditions and Privacy Policy to continue.'
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
      showToast("We couldn't create your account just now. Please try again.", 'error')
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Start with an ASK"
      subtitle="One account does it all. Post ASKs when you need something, respond when you can help, or do both."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
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

          <div className={styles.terms}>
            <label className={styles.termsLabel}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => {
                  setAcceptedTerms(event.target.checked)
                  setErrors((current) => ({ ...current, terms: undefined }))
                }}
                aria-invalid={Boolean(errors.terms)}
                aria-describedby={errors.terms ? 'terms-error' : undefined}
              />
              <span>
                I agree to the <Link to="/terms">Terms & Conditions</Link> and{' '}
                <Link to="/privacy">Privacy Policy</Link>
              </span>
            </label>
            {errors.terms && (
              <p id="terms-error" className={styles.termsError} role="alert">
                {errors.terms}
              </p>
            )}
          </div>

          <Button type="submit" fullWidth loading={submitting}>
            Create account
          </Button>
        </form>
    </AuthLayout>
  )
}
