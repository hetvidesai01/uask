import { motion } from 'framer-motion'

// Progress fill that springs to its value using transform (scaleX) rather than
// animating width, so it never triggers layout. Give it the same className you
// would give a static fill (colour/height/radius); width is handled here.
export default function SpringFill({ value, className = '', delay = 0 }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <motion.div
      className={className}
      style={{ width: '100%', transformOrigin: 'left center' }}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: clamped / 100 }}
      transition={{ type: 'spring', stiffness: 110, damping: 22, delay }}
    />
  )
}
