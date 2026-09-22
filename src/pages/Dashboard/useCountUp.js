import { useEffect, useState } from 'react'
import { animate } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'

// `animate()` is Framer Motion's imperative API — unlike `motion.*`
// components it does not read the app-level <MotionConfig reducedMotion>
// context automatically, so reduced motion is checked explicitly here.
export function useCountUp(target, { duration = 0.8 } = {}) {
  const prefersReducedMotion = useReducedMotion()
  const [value, setValue] = useState(target)
  const [trackedTarget, setTrackedTarget] = useState(target)

  // Reduced motion: jump straight to the new value during render rather
  // than via a synchronous setState inside an effect.
  if (prefersReducedMotion && target !== trackedTarget) {
    setTrackedTarget(target)
    setValue(target)
  }

  useEffect(() => {
    if (prefersReducedMotion) return

    const controls = animate(0, target, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => setValue(Math.round(latest)),
    })

    return () => controls.stop()
  }, [target, duration, prefersReducedMotion])

  return value
}
