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

  const isDisabled = disabled || loading
  // Native `disabled` only applies to real form controls — a non-button
  // element (e.g. `as="a"`) needs the ARIA equivalent instead.
  const disabledProps =
    Component === 'button' ? { disabled: isDisabled } : { 'aria-disabled': isDisabled }

  return (
    <Component
      className={classes}
      aria-busy={loading || undefined}
      {...disabledProps}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </Component>
  )
}
