import styles from './StatusRail.module.css'

const STAGES = ['ASK', 'MATCH', 'RESPOND', 'COMPARE', 'CONNECT']

// Presentational-only mapping from the ask's existing status string to a
// stage index on the rail — doesn't change or read any new data.
const STATUS_STAGE = {
  open: 0,
  matched: 1,
  in_review: 3,
  accepted: 4,
  closed: 4,
}

export default function StatusRail({ status }) {
  const currentStage = STATUS_STAGE[status] ?? 0

  return (
    <div className={styles.rail} role="img" aria-label={`Status: ${STAGES[currentStage]}`}>
      {STAGES.map((stage, index) => (
        <div key={stage} className={styles.node}>
          <span
            className={[styles.dot, index <= currentStage ? styles.done : '']
              .filter(Boolean)
              .join(' ')}
          />
          <span className={[styles.label, index === currentStage ? styles.current : '']
            .filter(Boolean)
            .join(' ')}
          >
            {stage}
          </span>
          {index < STAGES.length - 1 && (
            <span
              className={[styles.connector, index < currentStage ? styles.done : '']
                .filter(Boolean)
                .join(' ')}
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  )
}
