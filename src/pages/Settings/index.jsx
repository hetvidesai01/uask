import { useId } from 'react'
import { motion } from 'framer-motion'
import Card from '../../components/ui/Card'
import { Reveal, RevealGroup } from '../../components/ui/Reveal'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { SNAPPY_SPRING } from '../../utils/motion'
import styles from './Settings.module.css'

const APPEARANCE_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const ROLE_LABELS = { seeker: 'Seeker', provider: 'Provider' }

// Segmented control whose active pill springs between options (shared
// layout transition). Same buttons/aria-pressed semantics as before.
function Segmented({ label, options, value, onChange }) {
  const pillId = useId()
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={[styles.segmentOption, active ? styles.segmentActive : ''].filter(Boolean).join(' ')}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {active && (
              <motion.span
                layoutId={`segment-pill-${pillId}`}
                className={styles.segmentPill}
                transition={SNAPPY_SPRING}
                aria-hidden="true"
              />
            )}
            <span className={styles.segmentLabel}>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function Settings() {
  const { user, activeRole, setActiveRole } = useAuth()
  const { preference, setPreference } = useTheme()

  // Placeholder, frontend-only notification preferences — no backend to
  // send anything yet, just remembered locally so the toggles feel real.
  const [emailNotifications, setEmailNotifications] = useLocalStorage(
    'uask.settings.emailNotifications',
    true
  )
  const [productUpdates, setProductUpdates] = useLocalStorage('uask.settings.productUpdates', false)

  const hasBothRoles = (user.roles ?? []).length > 1
  const roleOptions = (user.roles ?? []).map((role) => ({ value: role, label: ROLE_LABELS[role] ?? role }))

  return (
    <RevealGroup calm className={styles.page}>
      <Reveal className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage how UASK looks and behaves for your account.</p>
      </Reveal>

      <Reveal>
        <Card padding="lg" className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Appearance</h2>
            <p className={styles.sectionCopy}>
              Light is the default UASK experience. System follows your device's setting.
            </p>
          </div>

          <Segmented label="Appearance" options={APPEARANCE_OPTIONS} value={preference} onChange={setPreference} />
        </Card>
      </Reveal>

      <Reveal>
        <Card padding="lg" className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Account & preferences</h2>
            <p className={styles.sectionCopy}>Basic account details. Edit your public profile from Profile.</p>
          </div>

          <dl className={styles.fieldList}>
            <div className={styles.field}>
              <dt>Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div className={styles.field}>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>

          {hasBothRoles && (
            <div className={styles.roleSwitch}>
              <span className={styles.fieldLabel}>Currently acting as</span>
              <Segmented label="Active role" options={roleOptions} value={activeRole} onChange={setActiveRole} />
            </div>
          )}

          <p className={styles.comingSoon}>More account preferences are coming soon.</p>
        </Card>
      </Reveal>

      <Reveal>
        <Card padding="lg" className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Payment details</h2>
            <p className={styles.sectionCopy}>
              No payment method is connected yet — Payments &amp; Milestones remains mock-only for now.
            </p>
          </div>
          <p className={styles.comingSoon}>Adding a payment method and payout details isn't available yet.</p>
        </Card>
      </Reveal>

      <Reveal>
        <Card padding="lg" className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Notifications</h2>
            <p className={styles.sectionCopy}>
              Placeholder preferences — UASK doesn't send real emails yet, but this remembers your choice.
            </p>
          </div>

          <label className={styles.toggleRow}>
            <span>Email notifications</span>
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(event) => setEmailNotifications(event.target.checked)}
            />
          </label>

          <label className={styles.toggleRow}>
            <span>Product updates</span>
            <input
              type="checkbox"
              checked={productUpdates}
              onChange={(event) => setProductUpdates(event.target.checked)}
            />
          </label>
        </Card>
      </Reveal>
    </RevealGroup>
  )
}
