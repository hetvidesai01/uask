import { motion } from 'framer-motion'
import { revealGroup, revealItem, SOFT_SPRING } from '../../utils/motion'
import styles from './PortfolioSection.module.css'

export default function PortfolioSection({ items }) {
  return (
    <motion.div className={styles.grid} initial="hidden" animate="visible" variants={revealGroup}>
      {items.map((item) => (
        <motion.div
          key={item.id}
          className={styles.card}
          variants={revealItem}
          whileHover={{ y: -4 }}
          transition={SOFT_SPRING}
        >
          <div className={styles.thumb}>
            {item.thumbnail ? (
              <img src={item.thumbnail} alt="" className={styles.thumbImg} />
            ) : (
              <span className={styles.thumbPlaceholder} aria-hidden="true">
                {item.category ? item.category[0] : '✦'}
              </span>
            )}
          </div>
          <div className={styles.body}>
            <p className={styles.category}>{item.category}</p>
            <p className={styles.title}>{item.title}</p>
            <p className={styles.description}>{item.description}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
