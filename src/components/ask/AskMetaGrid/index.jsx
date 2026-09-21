import { formatBudgetRange } from '../../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../../utils/formatDate'
import styles from './AskMetaGrid.module.css'

export default function AskMetaGrid({ ask }) {
  const items = [
    { label: 'Budget', value: formatBudgetRange(ask.budgetMin, ask.budgetMax, ask.currency) },
    { label: 'Deadline', value: formatAbsoluteDate(ask.deadline) },
    { label: 'Location', value: ask.location },
    { label: 'Work type', value: ask.isRemote ? 'Remote' : 'On-site' },
    { label: 'Responses', value: `${ask.responseCount} ${ask.responseCount === 1 ? 'response' : 'responses'}` },
  ]

  return (
    <dl className={styles.grid}>
      {items.map((item) => (
        <div key={item.label} className={styles.item}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={styles.value}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
