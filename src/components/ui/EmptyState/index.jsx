import { motion } from 'framer-motion'
import { SOFT_SPRING } from '../../../utils/motion'
import styles from './EmptyState.module.css'

// One gentle settle-in (no looping) so empty/activity states feel alive
// without drawing attention.
export default function EmptyState({ icon, title, message, action }) {
  return (
    <motion.div
      className={styles.empty}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      {icon && (
        <motion.span
          className={styles.icon}
          aria-hidden="true"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SOFT_SPRING, delay: 0.08 }}
        >
          {icon}
        </motion.span>
      )}
      {title && <p className={styles.title}>{title}</p>}
      {message && <p className={styles.message}>{message}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </motion.div>
  )
}
