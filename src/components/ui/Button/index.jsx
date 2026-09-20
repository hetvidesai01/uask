import Spinner from '../Spinner'
import styles from './Button.module.css'

export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled = false,
  inverted = false,
  className = '',
  children,
  ...rest
}) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    inverted ? styles.inverted : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Component className={classes} disabled={disabled || loading} {...rest}>
      {loading && <Spinner size="sm" />}
      {children}
    </Component>
  )
}
