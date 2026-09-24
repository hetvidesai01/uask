import { motion } from 'framer-motion'
import SignalMark from '../../components/ui/SignalMark'
import { useInView } from '../../hooks/useInView'
import styles from './FlowSection.module.css'

const STEPS = ['ASK', 'MATCH', 'RESPOND', 'COMPARE', 'CONNECT']

// Delay (seconds) at which each step's label "arrives" — also drives the
// matching visual beat below. Kept short and front-loaded so the whole
// sequence settles well under 3s.
const STEP_DELAY = { ASK: 0, MATCH: 0.3, RESPOND: 0.75, COMPARE: 1.35, CONNECT: 1.95 }

const OFFERS = [
  { id: 'amara', name: 'Amara O.', price: '$280', selected: false },
  { id: 'diego', name: 'Diego M.', price: '$240', selected: true },
  { id: 'priya', name: 'Priya N.', price: '$310', selected: false },
]

// The ASK -> MATCH -> RESPOND -> COMPARE -> CONNECT product story, told as
// a small staged scene rather than five plain text boxes. Plays once when
// scrolled into view (see useInView — it unobserves after the first
// intersection), then settles into a readable final state: one offer
// highlighted as the connection made. Every motion.* element sits inside
// the app-level <MotionConfig reducedMotion="user">, so this collapses to
// the final state instantly when the user prefers reduced motion.
export default function FlowSection() {
  const [ref, isInView] = useInView({ threshold: 0.35 })

  return (
    <section id="how-it-works" className={`section ${styles.flow}`}>
      <div className="container">
        <div className={styles.headingRow}>
          <h2 className={styles.heading}>How UASK works</h2>
          <p className={styles.subheading}>One ASK, told from post to pick.</p>
        </div>

        <div className={styles.steps} aria-hidden="true">
          {STEPS.map((step, index) => (
            <span key={step} className={styles.stepWrap}>
              <motion.span
                className={styles.step}
                initial={{ color: 'var(--c-text-faint)' }}
                animate={{ color: isInView ? 'var(--c-text)' : 'var(--c-text-faint)' }}
                transition={{ duration: 0.3, delay: STEP_DELAY[step] }}
              >
                {step}
              </motion.span>
              {index < STEPS.length - 1 && (
                <span className={styles.stepArrow} aria-hidden="true">
                  →
                </span>
              )}
            </span>
          ))}
        </div>

        <div ref={ref} className={styles.stage}>
          <motion.div
            className={styles.askCard}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.4 }}
          >
            <span className={styles.askEyebrow}>Photography</span>
            <p className={styles.askTitle}>Family portrait session this weekend</p>
          </motion.div>

          <div className={styles.markRow}>
            {isInView && (
              <SignalMark size="sm" rings={2} animated className={styles.mark} />
            )}
            <span className={styles.markCaption}>Relevant providers are notified</span>
          </div>

          <div className={styles.offers}>
            {OFFERS.map((offer, index) => (
              <motion.div
                key={offer.id}
                className={[styles.offerCard, offer.selected ? styles.selected : ''].join(' ')}
                initial={{ opacity: 0, y: 14, scale: 0.95 }}
                animate={
                  isInView
                    ? {
                        opacity: offer.selected ? 1 : 0.7,
                        y: 0,
                        scale: offer.selected ? 1 : 0.97,
                      }
                    : {}
                }
                transition={{
                  opacity: { duration: 0.35, delay: STEP_DELAY.RESPOND + index * 0.15 },
                  y: { duration: 0.35, delay: STEP_DELAY.RESPOND + index * 0.15 },
                  scale: { duration: 0.35, delay: offer.selected ? STEP_DELAY.CONNECT : STEP_DELAY.RESPOND + index * 0.15 },
                }}
              >
                <span className={styles.offerAvatar} aria-hidden="true">
                  {offer.name.charAt(0)}
                </span>
                <span className={styles.offerName}>{offer.name}</span>
                <span className={styles.offerPrice}>{offer.price}</span>
                {offer.selected && (
                  <motion.span
                    className={styles.selectedBadge}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 0.3, delay: STEP_DELAY.CONNECT + 0.1 }}
                  >
                    Connected
                  </motion.span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
