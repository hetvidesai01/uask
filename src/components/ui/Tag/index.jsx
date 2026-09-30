import { motion } from 'framer-motion'
import { SNAPPY_SPRING } from '../../../utils/motion'
import styles from './Tag.module.css'

// Chips spring slightly on hover/press and pop in when added.
export default function Tag({ children, onRemove }) {
  return (
    <motion.span
      className={styles.tag}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={SNAPPY_SPRING}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={`Remove ${children}`}
        >
          ✕
        </button>
      )}
    </motion.span>
  )
}
