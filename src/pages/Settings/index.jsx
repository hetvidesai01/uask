import Card from '../../components/ui/Card'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import styles from './Settings.module.css'

const APPEARANCE_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const ROLE_LABELS = { seeker: 'Seeker', provider: 'Provider' }

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage how UASK looks and behaves for your account.</p>
      </div>

      <Card padding="lg" className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Appearance</h2>
          <p className={styles.sectionCopy}>
            Light is the default UASK experience. System follows your device's setting.
          </p>
        </div>

        <div className={styles.segmented} role="group" aria-label="Appearance">
          {APPEARANCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={[styles.segmentOption, preference === option.value ? styles.segmentActive : '']
                .filter(Boolean)
                .join(' ')}
              aria-pressed={preference === option.value}
              onClick={() => setPreference(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Card>

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
            <div className={styles.segmented} role="group" aria-label="Active role">
              {user.roles.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={[styles.segmentOption, activeRole === role ? styles.segmentActive : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={activeRole === role}
                  onClick={() => setActiveRole(role)}
                >
                  {ROLE_LABELS[role] ?? role}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className={styles.comingSoon}>More account preferences are coming soon.</p>
      </Card>

      <Card padding="lg" className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Payment details</h2>
          <p className={styles.sectionCopy}>
            No payment method is connected yet — Payments &amp; Milestones remains mock-only for now.
          </p>
        </div>
        <p className={styles.comingSoon}>Adding a payment method and payout details isn't available yet.</p>
      </Card>

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
    </div>
  )
}
