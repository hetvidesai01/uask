import { useId } from 'react'
import styles from './Textarea.module.css'

export default function Textarea({
  label,
  error,
  maxLength,
  value,
  id,
  className = '',
  ...rest
}) {
  const generatedId = useId()
  const textareaId = id || generatedId

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={textareaId}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={[styles.textarea, error ? styles.errorInput : ''].filter(Boolean).join(' ')}
        maxLength={maxLength}
        value={value}
        aria-invalid={Boolean(error)}
        {...rest}
      />
      <div className={styles.footer}>
        {error && <span className={styles.error}>{error}</span>}
        {maxLength && (
          <span className={styles.count}>
            {(value?.length ?? 0)}/{maxLength}
          </span>
        )}
      </div>
    </div>
  )
}
