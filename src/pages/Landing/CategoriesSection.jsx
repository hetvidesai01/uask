import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card'
import { useInView } from '../../hooks/useInView'
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
        <h2 className={styles.heading}>Browse by category</h2>

        <div ref={ref} className={styles.grid}>
          {CATEGORIES.map((category, index) => (
            <Link key={category.label} to="/app/discover" className={styles.link}>
              <Card
                hoverable
                padding="sm"
                className={`reveal ${isInView ? 'isVisible' : ''} ${styles.category}`}
                style={{ transitionDelay: `${index * 60}ms` }}
              >
                <span className={styles.icon} aria-hidden="true">
                  {category.icon}
                </span>
                <span className={styles.label}>{category.label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
