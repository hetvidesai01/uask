import { useId } from 'react'
import styles from './Input.module.css'

export default function Input({
  label,
  error,
  hint,
  icon,
  id,
  className = '',
  ...rest
}) {
  const generatedId = useId()
  const inputId = id || generatedId

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className={styles.inputWrapper}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <input
          id={inputId}
          className={[styles.input, icon ? styles.withIcon : '', error ? styles.errorInput : '']
            .filter(Boolean)
            .join(' ')}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${inputId}-note` : undefined}
          {...rest}
        />
      </div>
      {(error || hint) && (
        <span id={`${inputId}-note`} className={error ? styles.error : styles.hint}>
          {error || hint}
        </span>
      )}
    </div>
  )
}
