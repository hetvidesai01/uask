import { useState } from 'react'
import { formatAbsoluteDateTime } from '../../utils/formatDate'
import styles from './ContractParts.module.css'

const COLLAPSED_COUNT = 5

export default function ContractHistory({ history }) {
  const [showAll, setShowAll] = useState(false)
  const items = [...history].reverse()
  const visible = showAll ? items : items.slice(0, COLLAPSED_COUNT)

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>Contract history</h2>
      <ul className={styles.history}>
        {visible.map((entry) => (
          <li key={entry.id} className={styles.historyItem}>
            <span className={styles.historyDot} aria-hidden="true" />
            <div className={styles.historyBody}>
              <p className={styles.historyAction}>
                <strong>{entry.actor}</strong> · {entry.action}
              </p>
              <time className={styles.historyTime} dateTime={entry.at}>
                {formatAbsoluteDateTime(entry.at)}
              </time>
            </div>
          </li>
        ))}
      </ul>
      {items.length > COLLAPSED_COUNT && (
        <button type="button" className={styles.linkButton} onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Show less' : `Show all (${items.length})`}
        </button>
      )}
    </div>
  )
}
