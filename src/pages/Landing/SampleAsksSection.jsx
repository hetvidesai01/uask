import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import Avatar from '../../components/ui/Avatar'
import Card from '../../components/ui/Card'
import AskStatusBadge from '../../components/ask/AskStatusBadge'
import { useInView } from '../../hooks/useInView'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { staggerContainer, staggerItem } from '../../utils/motion'
import { getAsks } from '../../services/askService'
import { getUserById } from '../../services/authService'
import { formatBudgetRange } from '../../utils/formatCurrency'
import styles from './SampleAsksSection.module.css'

const SAMPLE_COUNT = 3

// Pulls real ASKs (through askService, same call a real API would later
// serve) rather than a hand-duplicated fake array — this is what's
// actually in the mock dataset, not invented marketing content.
export default function SampleAsksSection() {
  const [ref, isInView] = useInView()
  const [samples, setSamples] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const results = await getAsks({ sort: 'newest' })
      const picked = results.slice(0, SAMPLE_COUNT)
      const withRequesters = await Promise.all(
        picked.map(async (ask) => ({ ask, requester: await getUserById(ask.requesterId) })),
      )
      if (!cancelled) setSamples(withRequesters)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className={`section ${styles.sampleAsks}`}>
      <div className="container">
        <h2 className={styles.heading}>Real ASKs, real momentum</h2>
        <p className={styles.subheading}>A live look at what&apos;s actually being posted.</p>

        {samples.length > 0 && (
          <motion.div
            ref={ref}
            className={styles.grid}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={staggerContainer}
            transition={{ staggerChildren: 0.12 }}
          >
            {samples.map(({ ask, requester }, index) => (
              <motion.div
                key={ask.id}
                variants={staggerItem}
                className={index % 2 === 1 ? styles.offset : ''}
              >
                <TiltCard>
                  <span className={styles.categoryEyebrow}>{ask.category}</span>

                  <div className={styles.cardHeader}>
                    <p className={styles.title}>{ask.title}</p>
                    <AskStatusBadge status={ask.status} />
                  </div>

                  <p className={styles.meta}>
                    {formatBudgetRange(ask.budgetMin, ask.budgetMax, ask.currency)} ·{' '}
                    {ask.isRemote ? 'Remote' : ask.location}
                  </p>

                  <div className={styles.footer}>
                    <div className={styles.requester}>
                      <Avatar name={requester?.name ?? 'UASK user'} size="sm" />
                      <span>{requester?.name ?? 'UASK user'}</span>
                    </div>
                    <span className={styles.responses}>
                      {ask.responseCount} {ask.responseCount === 1 ? 'offer' : 'offers'} so far
                    </span>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  )
}

// Restrained cursor-reactive tilt, desktop only in practice (mousemove
// never fires from touch input). Explicitly checked against reduced
// motion — useSpring/useTransform are Framer's imperative motion-value
// APIs, which (like the animate() call in useCountUp) don't read the
// <MotionConfig reducedMotion> context automatically.
function TiltCard({ children }) {
  const prefersReducedMotion = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-5, 5]), { stiffness: 300, damping: 30 })

  function handleMouseMove(event) {
    if (prefersReducedMotion) return
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
      className={styles.tiltWrap}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Card hoverable padding="md" className={styles.card}>
        {children}
      </Card>
    </motion.div>
  )
}
