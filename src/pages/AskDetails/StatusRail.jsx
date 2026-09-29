import { motion } from 'framer-motion'
import SignalMark from '../../components/ui/SignalMark'
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

// Reuses the UASK "signal" language (SignalMark) for the current stage —
// a restrained, one-shot reveal (no looping), consistent with how the rest
// of the app treats this motif (Landing, Help).
export default function StatusRail({ status }) {
  const currentStage = STATUS_STAGE[status] ?? 0

  return (
    <div className={styles.rail} role="img" aria-label={`Current stage: ${STAGES[currentStage]}`}>
      {STAGES.map((stage, index) => {
        const done = index < currentStage
        const isCurrent = index === currentStage

        return (
          <div key={stage} className={styles.node}>
            <div className={styles.markerSlot}>
              {isCurrent ? (
                <SignalMark size="sm" rings={2} animated className={styles.currentMark} />
              ) : (
                <motion.span
                  className={[styles.dot, done ? styles.done : ''].filter(Boolean).join(' ')}
                  initial={false}
                  animate={{ scale: done ? 1 : 0.85 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                />
              )}
            </div>

            <span className={[styles.label, isCurrent ? styles.current : ''].filter(Boolean).join(' ')}>
              {stage}
            </span>

            {index < STAGES.length - 1 && (
              <span className={styles.connector} aria-hidden="true">
                <motion.span
                  className={styles.connectorFill}
                  initial={false}
                  animate={{ scaleX: index < currentStage ? 1 : 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 30, delay: index * 0.06 }}
                />
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
