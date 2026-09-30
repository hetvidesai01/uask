import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { SNAPPY_SPRING } from '../../../utils/motion'
import styles from './BackToTop.module.css'

const SHOW_AFTER_PX = 480

// Floating "Back to top" control. Hidden near the top of the page, fades and
// slides in after scrolling, and scrolls back up on click (instantly under
// reduced motion). Mounted on the public Landing page only.
export default function BackToTop() {
  const [visible, setVisible] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          className={styles.button}
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          transition={SNAPPY_SPRING}
        >
          <svg className={styles.icon} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M12 19V5M5 12l7-7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.label}>Back to top</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
