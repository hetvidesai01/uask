import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import Button from '../../components/ui/Button'
import { isRequired, isValidEmail } from '../../utils/validators'
import styles from './About.module.css'

const EMPTY = { name: '', email: '', subject: '', message: '' }

// Mock-functional only: validates, waits briefly, then shows a success
// state. Nothing is sent anywhere — no email API, no backend.
export default function ContactSection() {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function validate() {
    const next = {}
    if (!isRequired(values.name)) next.name = 'Enter your name.'
    if (!isValidEmail(values.email.trim())) next.email = 'Enter a valid email address.'
    if (!isRequired(values.subject)) next.subject = 'Add a subject.'
    if (!isRequired(values.message)) next.message = 'Write a short message.'
    return next
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSending(true)
    await new Promise((resolve) => setTimeout(resolve, 600))
    setSending(false)
    setSent(true)
  }

  function reset() {
    setValues(EMPTY)
    setErrors({})
    setSent(false)
  }

  const firstName = values.name.trim().split(' ')[0]

  return (
    <section id="contact" className={styles.contactGrid}>
      <div className={styles.contactIntro}>
        <h2 className={styles.h2}>Have a question? Let&apos;s talk.</h2>
        <p className={styles.body}>
          Questions, feedback or ideas — we read every message. Write to us and we&apos;ll get back to you.
        </p>
        <p className={styles.contactEmail}>hello@uask.example</p>
      </div>

      <div className={styles.formCard}>
        <AnimatePresence mode="wait" initial={false}>
          {sent ? (
            <motion.div
              key="sent"
              className={styles.success}
              role="status"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
            >
              <span className={styles.successIcon} aria-hidden="true">
                ✓
              </span>
              <h3 className={styles.successTitle}>Message sent</h3>
              <p className={styles.body}>
                Thanks{firstName ? `, ${firstName}` : ''} — this is a prototype, so nothing was actually delivered, but
                this is how it will look.
              </p>
              <Button variant="secondary" onClick={reset}>
                Send another message
              </Button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              className={styles.form}
              onSubmit={handleSubmit}
              noValidate
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
            >
              <Input
                label="Name"
                value={values.name}
                onChange={(event) => update('name', event.target.value)}
                error={errors.name}
                autoComplete="name"
              />
              <Input
                label="Email"
                type="email"
                value={values.email}
                onChange={(event) => update('email', event.target.value)}
                error={errors.email}
                autoComplete="email"
              />
              <Input
                label="Subject"
                value={values.subject}
                onChange={(event) => update('subject', event.target.value)}
                error={errors.subject}
              />
              <Textarea
                label="Message"
                rows={5}
                value={values.message}
                onChange={(event) => update('message', event.target.value)}
                error={errors.message}
              />
              <Button type="submit" loading={sending}>
                Send Message
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
