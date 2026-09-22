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
      'Post one ASK instead of messaging providers one by one.',
      'Offers arrive with price and timeline already attached.',
      'Compare everything side by side before you commit.',
    ],
    cta: 'Post an ASK',
  },
  {
    title: 'For providers',
    accent: 'pink',
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
