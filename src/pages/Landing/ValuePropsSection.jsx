import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../../components/ui/Button'
import { useInView } from '../../hooks/useInView'
import { staggerContainer, staggerItem } from '../../utils/motion'
import styles from './ValuePropsSection.module.css'

const COLUMNS = [
  {
    title: 'For seekers',
    accent: 'red',
    points: [
      'Write one ASK instead of messaging people one at a time.',
      'Offers arrive with a price and timeline already included.',
      'Put them side by side and take your time deciding.',
    ],
    cta: 'Post an ASK',
  },
  {
    title: 'For providers',
    accent: 'pink',
    points: [
      'See requests that fit the work you actually do.',
      'Send a thoughtful offer instead of chasing cold leads.',
      'Build a track record that shows on your profile.',
    ],
    cta: 'Start responding',
  },
]

export default function ValuePropsSection() {
  const [ref, isInView] = useInView()

  return (
    <section className={`section ${styles.section}`}>
      <div className="container">
        <h2 className={styles.heading}>Made for both sides of an ASK</h2>

        <motion.div
          ref={ref}
          className={styles.split}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={staggerContainer}
          transition={{ staggerChildren: 0.15 }}
        >
          {COLUMNS.map((column) => (
            <motion.div
              key={column.title}
              className={[styles.column, styles[column.accent]].join(' ')}
              variants={staggerItem}
            >
              <p className={styles.eyebrow}>{column.title}</p>

              <ul className={styles.list}>
                {column.points.map((point, index) => (
                  <li key={point} className={styles.listItem}>
                    <span className={styles.itemNumber} aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <Button as={Link} to="/signup" variant="secondary">
                {column.cta}
              </Button>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
