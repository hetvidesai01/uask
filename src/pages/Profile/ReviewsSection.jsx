import { Link } from 'react-router-dom'
import { formatAbsoluteDate } from '../../utils/formatDate'
import styles from './ReviewsSection.module.css'

export default function ReviewsSection({ reviews }) {
  return (
    <div className={styles.list}>
      {reviews.map((review) => (
        <article key={review.id} className={styles.card}>
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
        </article>
      ))}
    </div>
  )
}
