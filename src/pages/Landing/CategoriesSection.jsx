import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useInView } from '../../hooks/useInView'
import { getCategories } from '../../services/askService'
import styles from './CategoriesSection.module.css'

// Extremely subtle, fixed (not random — keeps re-renders deterministic)
// alternating tilt per chip, straightened out on hover/focus.
const TILTS = [-2, 1.5, -1, 2, -1.5, 1, -2, 1.5]

const chipVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 10 },
  visible: (index) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    rotate: TILTS[index % TILTS.length],
    transition: { type: 'spring', stiffness: 320, damping: 20, delay: index * 0.04 },
  }),
}

export default function CategoriesSection() {
  const [ref, isInView] = useInView()
  const [categories, setCategories] = useState([])

  useEffect(() => {
    let cancelled = false
    getCategories().then((results) => {
      if (!cancelled) setCategories(results)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="section">
      <div className="container">
        <h2 className={styles.heading}>Discover by category</h2>
        <p className={styles.subheading}>Whatever you need, there&apos;s probably an ASK for it.</p>

        <motion.div
          ref={ref}
          className={styles.cluster}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              custom={index}
              variants={chipVariants}
              whileHover={{ rotate: 0, scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              className={styles.chipWrap}
            >
              <Link
                to={`/app/discover?category=${encodeURIComponent(category.label)}`}
                className={styles.chip}
              >
                <span className={styles.icon} aria-hidden="true">
                  {category.icon}
                </span>
                <span className={styles.label}>{category.label}</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
