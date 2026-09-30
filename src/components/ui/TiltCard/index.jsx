import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import styles from './TiltCard.module.css'

// Restrained cursor-reactive tilt — desktop only in practice (mousemove
// never fires from touch input), capped to a small ±5deg range so it reads
// as "physical object", not a gimmick. Explicitly checked against reduced
// motion — useSpring/useTransform are Framer's imperative motion-value
// APIs, which don't read the app-level <MotionConfig reducedMotion>
// context automatically. A standalone atom (not reused from Landing's
// page-local TiltCard) so Discover can use it without touching Landing.
export default function TiltCard({ children, className = '', maxTilt = 5 }) {
  const prefersReducedMotion = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [maxTilt, -maxTilt]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-maxTilt, maxTilt]), { stiffness: 300, damping: 30 })

  function handleMouseMove(event) {
    if (prefersReducedMotion) return
    // Hover-capable pointers only — no tilt on touch devices.
    if (!window.matchMedia('(hover: hover)').matches) return
    const rect = event.currentTarget.getBoundingClientRect()
    x.set((event.clientX - rect.left) / rect.width - 0.5)
    y.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  function handleMouseLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      className={[styles.wrap, className].filter(Boolean).join(' ')}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  )
}
