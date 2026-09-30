import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import EmptyState from '../../components/ui/EmptyState'
import { formatRelativeDate } from '../../utils/formatDate'
import { revealGroup, revealItem } from '../../utils/motion'
import styles from './ActivityFeed.module.css'

export default function ActivityFeed({ items }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="🕓"
        title="No activity yet"
        message="Post an ASK or respond to one — your activity will show up here."
      />
    )
  }

  return (
    <motion.ul className={styles.feed} initial="hidden" animate="visible" variants={revealGroup}>
      {items.map((item) => (
        <motion.li key={item.id} className={styles.item} variants={revealItem}>
          <span className={styles.icon} aria-hidden="true">
            {item.icon}
          </span>
          <span className={styles.text}>
            {item.text}
            <Link to={item.to} className={styles.link}>
              {item.linkText}
            </Link>
          </span>
          <span className={styles.time}>{formatRelativeDate(item.date)}</span>
        </motion.li>
      ))}
    </motion.ul>
  )
}
