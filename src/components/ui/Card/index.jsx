import styles from './Card.module.css'

export default function Card({
  padding = 'md',
  hoverable = false,
  className = '',
  children,
  ...rest
}) {
  const classes = [styles.card, styles[padding], hoverable ? styles.hoverable : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
