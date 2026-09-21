import styles from './StepIndicator.module.css'

export default function StepIndicator({ steps, current }) {
  return (
    <nav aria-label="Progress">
      <ol className={styles.list}>
        {steps.map((label, index) => {
          const stepNumber = index + 1
          const state = stepNumber < current ? 'done' : stepNumber === current ? 'active' : 'upcoming'

          return (
            <li key={label} className={styles.item} data-state={state}>
              <span className={styles.circle} aria-hidden="true">
                {state === 'done' ? '✓' : stepNumber}
              </span>
              <span className={styles.label}>{label}</span>
            </li>
          )
        })}
      </ol>
      <p className={styles.status} aria-live="polite">
        Step {current} of {steps.length}: {steps[current - 1]}
      </p>
    </nav>
  )
}
