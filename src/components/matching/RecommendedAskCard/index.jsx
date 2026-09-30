import { Link } from 'react-router-dom'
import Card from '../../ui/Card'
import MotionCard from '../../ui/MotionCard'
import MatchBadge from '../MatchBadge'
import { formatBudgetRange } from '../../../utils/formatCurrency'
import styles from './RecommendedAskCard.module.css'

// Compact — Discover's "Recommended for you" row is meant to be scanned
// fast, not read like a full ASK card. Reasons are joined inline rather
// than bulleted (e.g. "React · Remote · Budget fits").
export default function RecommendedAskCard({ match }) {
  const { ask, score, label, reasons } = match

  return (
    <MotionCard as="div" lift={3}>
    <Link to={`/app/asks/${ask.id}`} className={styles.link}>
      <Card hoverable padding="md" className={styles.card}>
        <div className={styles.top}>
          <span className={styles.category}>{ask.category}</span>
          <MatchBadge score={score} label={label} size="sm" />
        </div>

        <h3 className={styles.title}>{ask.title}</h3>

        <span className={styles.budget}>{formatBudgetRange(ask.budgetMin, ask.budgetMax, ask.currency)}</span>

        {reasons.length > 0 && <p className={styles.reasons}>{reasons.join(' · ')}</p>}
      </Card>
    </Link>
    </MotionCard>
  )
}
