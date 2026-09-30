import { motion } from 'framer-motion'
import { SOFT_SPRING } from '../../../utils/motion'

// Thin wrapper adding a subtle spring hover-lift + press to any card-like
// block. Transform-only; pointer-driven, so it never delays interaction.
export default function MotionCard({ as = 'div', lift = 3, children, ...rest }) {
  const Component = motion[as] ?? motion.div
  return (
    <Component whileHover={{ y: -lift }} whileTap={{ scale: 0.995 }} transition={SOFT_SPRING} {...rest}>
      {children}
    </Component>
  )
}
