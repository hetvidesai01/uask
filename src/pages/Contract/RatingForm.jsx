import { useState } from 'react'
import Button from '../../components/ui/Button'
import Textarea from '../../components/ui/Textarea'
import styles from './Contract.module.css'

const STARS = [1, 2, 3, 4, 5]

export default function RatingForm({ onSubmit, submitting }) {
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit({ rating, review: review.trim() })
  }

  return (
    <form className={styles.ratingForm} onSubmit={handleSubmit}>
      <h2 className={styles.sectionTitle}>Rate this provider</h2>

      <div className={styles.starRow} role="radiogroup" aria-label="Rating out of 5">
        {STARS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} star${value > 1 ? 's' : ''}`}
            className={[styles.starButton, value <= rating ? styles.starButtonFilled : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => setRating(value)}
          >
            ★
          </button>
        ))}
      </div>

      <Textarea
        label="Review (optional)"
        placeholder="How did this project go?"
        maxLength={280}
        value={review}
        onChange={(event) => setReview(event.target.value)}
      />

      <Button type="submit" loading={submitting}>
        Submit rating
      </Button>
    </form>
  )
}
