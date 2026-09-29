import { useId, useState } from 'react'
import styles from './WhyThisMatch.module.css'

// Explainability affordance for a match score — reveals the concrete
// reasons behind it on hover, keyboard focus, or click (same accessible
// tooltip pattern as Profile's "Profile Booster" info button). Never
// claims certainty — reasons are plainly worded, no "% confidence".
export default function WhyThisMatch({ reasons }) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()

  if (!reasons || reasons.length === 0) return null

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-describedby={tooltipId}
        onClick={() => setOpen((current) => !current)}
      >
        Why this match?
      </button>
      <div
        role="tooltip"
        id={tooltipId}
        className={[styles.panel, open ? styles.panelVisible : ''].filter(Boolean).join(' ')}
      >
        <ul className={styles.list}>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </span>
  )
}
