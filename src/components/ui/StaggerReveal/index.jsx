import { motion } from 'framer-motion'
import { useInView } from '../../../hooks/useInView'
import { staggerContainer } from '../../../utils/motion'

// Generic scroll-reveal wrapper: animates its children in as a group the
// first time it enters the viewport. Children should be `motion.*`
// elements using the `staggerItem` variant (see utils/motion.js) so they
// pick up the staggered timing this container sets up — see SignalRail
// for a worked example of the parent/child pairing.
export default function StaggerReveal({ children, className = '', threshold = 0.15, ...rest }) {
  const [ref, isInView] = useInView({ threshold })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={staggerContainer}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
