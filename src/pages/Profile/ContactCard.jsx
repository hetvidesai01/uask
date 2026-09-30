import Card from '../../components/ui/Card'
import MessageUserButton from '../../components/people/MessageUserButton'
import styles from './ContactCard.module.css'

function toUrl(value, base) {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (base) return `${base}${trimmed.replace(/^@/, '')}`
  return `https://${trimmed}`
}

function displayHandle(value) {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/\/$/, '')
}

// Only rendered for Connected users — Profile passes `details` from
// profileService.getContactDetails, which returns nothing otherwise.
export default function ContactCard({ currentUserId, targetUserId, details }) {
  const rows = []
  if (details?.linkedin) {
    rows.push({
      key: 'linkedin',
      icon: 'in',
      label: 'LinkedIn',
      text: displayHandle(details.linkedin),
      href: toUrl(details.linkedin),
    })
  }
  if (details?.instagram) {
    rows.push({
      key: 'instagram',
      icon: '◎',
      label: 'Instagram',
      text: details.instagram.trim().startsWith('http')
        ? displayHandle(details.instagram)
        : `@${details.instagram.trim().replace(/^@/, '')}`,
      href: toUrl(details.instagram, 'https://instagram.com/'),
    })
  }
  if (details?.contactEmail) {
    rows.push({
      key: 'email',
      icon: '✉',
      label: 'Email',
      text: details.contactEmail,
      href: `mailto:${details.contactEmail}`,
    })
  }

  return (
    <Card padding="lg" className={styles.card}>
      <h2 className={styles.title}>Contact</h2>
      <MessageUserButton currentUserId={currentUserId} targetUserId={targetUserId} size="md" fullWidth>
        Message on UASK
      </MessageUserButton>

      {rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.key}>
              <a
                href={row.href}
                className={styles.row}
                target={row.key === 'email' ? undefined : '_blank'}
                rel="noopener noreferrer"
              >
                <span className={styles.icon} aria-hidden="true">
                  {row.icon}
                </span>
                <span className={styles.rowBody}>
                  <span className={styles.rowLabel}>{row.label}</span>
                  <span className={styles.rowText}>{row.text}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
