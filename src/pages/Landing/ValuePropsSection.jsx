import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { useInView } from '../../hooks/useInView'
import styles from './ValuePropsSection.module.css'

const COLUMNS = [
  {
    title: 'For seekers',
    points: [
      'Post one ASK instead of messaging providers one by one.',
      'Offers arrive with price and timeline already attached.',
      'Compare everything side by side before you commit.',
    ],
    cta: 'Post an ASK',
  },
  {
    title: 'For providers',
    points: [
      'See ASKs that match what you actually do.',
      'Send a focused offer instead of chasing cold leads.',
      'Build a track record that shows up on your profile.',
    ],
    cta: 'Start responding',
  },
]

export default function ValuePropsSection() {
  const [ref, isInView] = useInView()

  return (
    <section className="section">
      <div className="container">
        <h2 className={styles.heading}>Built for both sides of the ask</h2>

        <div ref={ref} className={styles.columns}>
          {COLUMNS.map((column, index) => (
            <Card
              key={column.title}
              padding="lg"
              className={`reveal ${isInView ? 'isVisible' : ''} ${styles.column}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <p className={styles.columnTitle}>{column.title}</p>
              <ul className={styles.list}>
                {column.points.map((point) => (
                  <li key={point} className={styles.listItem}>
                    <span className={styles.bullet} aria-hidden="true">
                      —
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Button as={Link} to="/signup" variant="secondary">
                {column.cta}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
