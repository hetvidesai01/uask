import { motion } from 'framer-motion'
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
              {index > 0 && (
                <span className={styles.connector} aria-hidden="true">
                  <motion.span
                    className={styles.connectorFill}
                    initial={false}
                    animate={{ scaleX: state === 'done' ? 1 : 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                  />
                </span>
              )}
              <motion.span
                className={styles.circle}
                initial={false}
                animate={{ scale: state === 'active' ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              >
                {state === 'done' ? '✓' : stepNumber}
              </motion.span>
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
