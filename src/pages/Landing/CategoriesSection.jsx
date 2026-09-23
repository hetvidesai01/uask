import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useInView } from '../../hooks/useInView'
import { staggerContainer, staggerItem } from '../../utils/motion'
import styles from './CategoriesSection.module.css'

const CATEGORIES = [
  { icon: '🎨', label: 'Design' },
  { icon: '✍️', label: 'Writing' },
  { icon: '💻', label: 'Development' },
  { icon: '🏠', label: 'Home services' },
  { icon: '📸', label: 'Photography' },
  { icon: '🎓', label: 'Tutoring' },
  { icon: '🎉', label: 'Events' },
  { icon: '📦', label: 'Errands' },
]

export default function CategoriesSection() {
  const [ref, isInView] = useInView()

  return (
    <section className="section">
      <div className="container">
        <h2 className={styles.heading}>Discover by category</h2>

        <motion.div
          ref={ref}
          className={styles.grid}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={staggerContainer}
          transition={{ staggerChildren: 0.05 }}
        >
          {CATEGORIES.map((category) => (
            <motion.div key={category.label} variants={staggerItem}>
              <Link
                to={`/app/discover?category=${encodeURIComponent(category.label)}`}
                className={styles.item}
              >
                <span className={styles.icon} aria-hidden="true">
                  {category.icon}
                </span>
                <span className={styles.label}>{category.label}</span>
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
