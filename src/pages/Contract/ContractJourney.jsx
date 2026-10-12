import { motion } from 'framer-motion'
import { getStage } from '../../utils/contractMath'
import { SNAPPY_SPRING } from '../../utils/motion'
import styles from './ContractParts.module.css'

// Compact "where are we" tracker: Draft → Signed → 25% → 50% → 25% → Complete.
// Steps are derived from contract state, never stored.
function buildSteps(contract) {
  const signed = contract.signatures.seeker.signed && contract.signatures.provider.signed
  const paid = (key) => getStage(contract, key)?.status === 'paid'
  return [
    { label: 'Draft', sub: 'Generated', done: true },
    { label: 'Signed', sub: 'Both agree', done: signed },
    { label: 'Initial', sub: '25%', done: paid('initial') },
    { label: 'Progress', sub: '50% · ~60% work', done: paid('progress') },
    { label: 'Final', sub: '25%', done: paid('final') },
    { label: 'Complete', sub: 'Rate & review', done: contract.status === 'completed' },
  ]
}

export default function ContractJourney({ contract }) {
  const steps = buildSteps(contract)
  const currentIndex = steps.findIndex((step) => !step.done)

  return (
    <ol className={styles.journey} aria-label="Contract progress">
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex
        return (
          <li
            key={step.label}
            className={[styles.journeyStep, step.done ? styles.journeyDone : '', isCurrent ? styles.journeyCurrent : '']
              .filter(Boolean)
              .join(' ')}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <motion.span
              className={styles.journeyDot}
              initial={false}
              animate={{ scale: step.done || isCurrent ? 1.15 : 1 }}
              transition={SNAPPY_SPRING}
            >
              {step.done ? '✓' : ''}
            </motion.span>
            <span className={styles.journeyLabel}>{step.label}</span>
            <span className={styles.journeySub}>{step.sub}</span>
          </li>
        )
      })}
    </ol>
  )
}
