import styles from './Avatar.module.css'

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

export default function Avatar({ src, name = '', size = 'md', className = '' }) {
  const classes = [styles.avatar, styles[size], className].filter(Boolean).join(' ')

  return (
    <span className={classes} title={name}>
      {src ? (
        <img className={styles.image} src={src} alt={name} loading="lazy" />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  )
}
