import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Card from '../../ui/Card'
import TiltCard from '../../ui/TiltCard'
import Avatar from '../../ui/Avatar'
import AskStatusBadge from '../AskStatusBadge'
import { hoverLift, SNAPPY_SPRING } from '../../../utils/motion'
import { formatBudgetRange } from '../../../utils/formatCurrency'
import { formatRelativeDate, formatAbsoluteDate } from '../../../utils/formatDate'
import { getCategoryColorVar } from '../../../utils/categoryColor'
import styles from './AskCard.module.css'

// `editorial` opts into the Phase 4 Discover treatment (tilt + hover lift,
// requester byline, budget/deadline hierarchy). Left off (the default),
// this renders exactly as before — Dashboard's "My ASKs" and Search
// results both still use the plain card, unchanged.
export default function AskCard({ ask, requester, editorial = false }) {
  if (!editorial) {
    return (
      <Link to={`/app/asks/${ask.id}`} className={styles.link}>
        <Card hoverable className={styles.card}>
          <div className={styles.top}>
            <span className={styles.category}>{ask.category}</span>
            <AskStatusBadge status={ask.status} />
          </div>

          <h3 className={styles.title}>{ask.title}</h3>
          <p className={styles.description}>{ask.description}</p>

          <div className={styles.meta}>
            <span className={styles.budget}>
              {formatBudgetRange(ask.budgetMin, ask.budgetMax, ask.currency)}
            </span>
            <span className={styles.dot} aria-hidden="true">
              &middot;
            </span>
            <span>{ask.isRemote ? 'Remote' : ask.location}</span>
          </div>

          <div className={styles.footer}>
            <span>
              {ask.responseCount} {ask.responseCount === 1 ? 'response' : 'responses'}
            </span>
            <span>{formatRelativeDate(ask.createdAt)}</span>
          </div>
        </Card>
      </Link>
    )
  }

  return (
    <TiltCard>
      <motion.div initial="rest" whileHover="hover" whileFocus="hover" variants={hoverLift} className={styles.liftWrap}>
        <Link to={`/app/asks/${ask.id}`} className={styles.link}>
          <Card hoverable className={[styles.card, styles.editorialCard].join(' ')}>
            <div className={styles.top}>
              <motion.span
                className={styles.categoryTag}
                style={{ '--tag-color': `var(${getCategoryColorVar(ask.category)})` }}
                whileHover={{ scale: 1.07 }}
                transition={SNAPPY_SPRING}
              >
                {ask.category}
              </motion.span>
              <AskStatusBadge status={ask.status} />
            </div>

            <h3 className={styles.editorialTitle}>{ask.title}</h3>
            <p className={styles.description}>{ask.description}</p>

            <div className={styles.editorialMeta}>
              <span className={styles.budget}>
                {formatBudgetRange(ask.budgetMin, ask.budgetMax, ask.currency)}
              </span>
              <span className={styles.dot} aria-hidden="true">
                &middot;
              </span>
              <span>Due {formatAbsoluteDate(ask.deadline)}</span>
              <span className={styles.dot} aria-hidden="true">
                &middot;
              </span>
              <span>{ask.isRemote ? 'Remote' : ask.location}</span>
            </div>

            <div className={styles.editorialFooter}>
              {requester ? (
                <span className={styles.requester}>
                  <Avatar src={requester.avatarUrl} name={requester.name} size="sm" />
                  <span className={styles.requesterName}>{requester.name}</span>
                </span>
              ) : (
                <span />
              )}
              <span className={styles.footerMeta}>
                {ask.responseCount} {ask.responseCount === 1 ? 'response' : 'responses'} ·{' '}
                {formatRelativeDate(ask.createdAt)}
              </span>
            </div>
          </Card>
        </Link>
      </motion.div>
    </TiltCard>
  )
}
