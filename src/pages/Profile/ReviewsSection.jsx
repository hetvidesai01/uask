import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { formatAbsoluteDate } from '../../utils/formatDate'
import { revealGroup, revealItem, SOFT_SPRING } from '../../utils/motion'
import styles from './ReviewsSection.module.css'

export default function ReviewsSection({ reviews }) {
  return (
    <motion.div className={styles.list} initial="hidden" animate="visible" variants={revealGroup}>
      {reviews.map((review) => (
        <motion.article
          key={review.id}
          className={styles.card}
          variants={revealItem}
          whileHover={{ y: -2 }}
          transition={SOFT_SPRING}
        >
          <div className={styles.cardHeader}>
            <span className={styles.rating}>★ {review.rating.toFixed(1)} / 5</span>
            <span className={styles.date}>{formatAbsoluteDate(review.completedAt)}</span>
          </div>

          {review.text && <p className={styles.text}>{review.text}</p>}

          <p className={styles.meta}>
            <span className={styles.client}>{review.clientName}</span>
            {' · '}
            <Link to={`/app/asks/${review.askId}`} className={styles.askLink}>
              {review.askTitle}
            </Link>
          </p>
        </motion.article>
      ))}
    </motion.div>
  )
}
