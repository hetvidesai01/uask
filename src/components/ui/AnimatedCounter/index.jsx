import { useEffect, useState } from 'react'
import { animate } from 'framer-motion'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import styles from './AnimatedCounter.module.css'

// Counts up to `value` on mount/update. `animate()` is Framer Motion's
// imperative API — unlike `motion.*` components it doesn't read the
// app-level <MotionConfig reducedMotion> context automatically, so
// reduced motion is checked explicitly here (same pattern as
// pages/Dashboard/useCountUp.js, generalized into a reusable atom).
export default function AnimatedCounter({
  value,
  duration = 0.8,
  format,
  prefix = '',
  suffix = '',
  className = '',
}) {
  const prefersReducedMotion = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const [trackedValue, setTrackedValue] = useState(value)

  // Reduced motion: jump straight to the new value during render rather
  // than via a synchronous setState inside an effect.
  if (prefersReducedMotion && value !== trackedValue) {
    setTrackedValue(value)
    setDisplay(value)
  }

  useEffect(() => {
    if (prefersReducedMotion) return undefined

    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    })

    return () => controls.stop()
  }, [value, duration, prefersReducedMotion])

  const formatted = format ? format(display) : display

  return (
    <span className={[styles.counter, className].filter(Boolean).join(' ')}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
