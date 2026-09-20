import { useId } from 'react'
import styles from './Select.module.css'

export default function Select({
  label,
  options = [],
  error,
  hint,
  id,
  className = '',
  ...rest
}) {
  const generatedId = useId()
  const selectId = id || generatedId

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={selectId}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={[styles.select, error ? styles.errorInput : ''].filter(Boolean).join(' ')}
        aria-invalid={Boolean(error)}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {(error || hint) && <span className={error ? styles.error : styles.hint}>{error || hint}</span>}
    </div>
  )
}
