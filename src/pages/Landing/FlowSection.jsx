import { motion } from 'framer-motion'
import SignalMark from '../../components/ui/SignalMark'
import MatchBadge from '../../components/matching/MatchBadge'
import { useInView } from '../../hooks/useInView'
import styles from './FlowSection.module.css'

const STEPS = ['ASK', 'MATCH', 'RESPOND', 'COMPARE', 'CONNECT']

// Delay (seconds) at which each step's label "arrives" — also drives the
// matching visual beat below. Kept short and front-loaded so the whole
// sequence settles well under 3s.
const STEP_DELAY = { ASK: 0, MATCH: 0.3, RESPOND: 0.75, COMPARE: 1.35, CONNECT: 1.95 }

// Ranked highest score first, mirroring how CompareResponses orders real
// rankResponses() output. Static/illustrative numbers for this landing
// scene only — labels match matchingService's real thresholds (Excellent
// Match >=80, Strong Match >=55, else Relevant) so the language stays
// consistent with what a logged-in user actually sees in the product.
const OFFERS = [
  {
    id: 'diego',
    name: 'Diego M.',
    price: '₹20,000',
    score: 92,
    label: 'Excellent Match',
    reasons: ['Strong skill fit', '4.9★ · 6 similar projects'],
    top: true,
  },
  {
    id: 'amara',
    name: 'Amara O.',
    price: '₹23,000',
    score: 74,
    label: 'Strong Match',
    reasons: ['Great portfolio fit', '4.7★ rating'],
    top: false,
  },
  {
    id: 'priya',
    name: 'Priya N.',
    price: '₹26,000',
    score: 58,
    label: 'Relevant',
    reasons: ['Quote fits budget', 'New to this category'],
    top: false,
  },
]

// The ASK -> MATCH -> RESPOND -> COMPARE -> CONNECT product story, told as
// a small staged scene rather than five plain text boxes. The offer cards
// deliberately show a match score, a label, and short reasoning — UASK's
// matching ranks actual responders to this ASK, it doesn't pre-recommend
// providers before they've responded. Plays once when scrolled into view
// (see useInView — it unobserves after the first intersection), then
// settles into a readable final state. Every motion.* element sits inside
// the app-level <MotionConfig reducedMotion="user">, so this collapses to
// the final state instantly when the user prefers reduced motion.
export default function FlowSection() {
  const [ref, isInView] = useInView({ threshold: 0.35 })

  return (
    <section id="how-it-works" className={`section ${styles.flow}`}>
      <div className={styles.ambient} aria-hidden="true">
        <svg className={`${styles.ambientLeft}`} viewBox="0 0 320 560" fill="none">
          <path className={styles.blobA} d="M60 90c50-50 140-40 170 20s-10 130-80 140S10 190 60 90Z" fill="var(--c-pink)" opacity="0.35" />
          <g className={styles.driftSlow} stroke="var(--c-red)" strokeWidth="1.2" opacity="0.5">
            <circle cx="120" cy="330" r="30" />
            <circle cx="120" cy="330" r="60" opacity="0.6" />
            <circle cx="120" cy="330" r="92" opacity="0.35" />
          </g>
          <path d="M30 470C110 400 160 500 260 420" stroke="var(--c-red)" strokeWidth="1" strokeDasharray="3 6" opacity="0.4" />
          <g className={styles.driftFast} fill="var(--c-red)">
            <circle cx="260" cy="420" r="4" opacity="0.6" />
            <circle cx="190" cy="150" r="3" opacity="0.5" />
            <circle cx="40" cy="250" r="2.5" opacity="0.5" />
          </g>
        </svg>
        <svg className={`${styles.ambientRight}`} viewBox="0 0 320 560" fill="none">
          <path className={styles.blobB} d="M240 380c-60 60-170 40-190-30s60-120 130-110 110 90 60 140Z" fill="var(--c-pink)" opacity="0.3" />
          <g className={styles.driftFast} stroke="var(--c-red)" strokeWidth="1.2" opacity="0.5">
            <circle cx="210" cy="120" r="22" />
            <circle cx="210" cy="120" r="48" opacity="0.55" />
          </g>
          <path d="M290 40C210 120 250 230 130 290" stroke="var(--c-red)" strokeWidth="1" strokeDasharray="3 6" opacity="0.4" />
          <g className={styles.driftSlow} fill="var(--c-red)">
            <circle cx="130" cy="290" r="4" opacity="0.6" />
            <circle cx="270" cy="470" r="3" opacity="0.5" />
            <circle cx="90" cy="60" r="2.5" opacity="0.45" />
          </g>
        </svg>
      </div>
      <div className={`container ${styles.content}`}>
        <div className={styles.headingRow}>
          <h2 className={styles.heading}>How UASK works</h2>
          <p className={styles.subheading}>
            One ASK goes out, providers respond, and UASK ranks the responses so you compare the strongest fits
            first.
          </p>
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
            {isInView && <SignalMark size="sm" rings={2} animated className={styles.mark} />}
            <span className={styles.markCaption}>Relevant providers are notified</span>
          </div>

          <motion.p
            className={styles.rankCaption}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.3, delay: STEP_DELAY.COMPARE }}
          >
            3 responses came in — UASK ranks them by fit
          </motion.p>

          <div className={styles.offers}>
            {OFFERS.map((offer, index) => (
              <motion.div
                key={offer.id}
                className={[styles.offerCard, offer.top ? styles.topOffer : ''].join(' ')}
                initial={{ opacity: 0, y: 14, scale: 0.95 }}
                animate={isInView ? { opacity: 1, y: 0, scale: offer.top ? 1.03 : 1 } : {}}
                transition={{
                  opacity: { duration: 0.35, delay: STEP_DELAY.RESPOND + index * 0.15 },
                  y: { duration: 0.35, delay: STEP_DELAY.RESPOND + index * 0.15 },
                  scale: {
                    duration: 0.35,
                    delay: offer.top ? STEP_DELAY.COMPARE : STEP_DELAY.RESPOND + index * 0.15,
                  },
                }}
              >
                {offer.top && <span className={styles.topRibbon}>Top-ranked response</span>}

                <div className={styles.offerIdentity}>
                  <span className={styles.offerAvatar} aria-hidden="true">
                    {offer.name.charAt(0)}
                  </span>
                  <span className={styles.offerName}>{offer.name}</span>
                  <span className={styles.offerPrice}>{offer.price}</span>
                </div>

                <motion.div
                  className={styles.offerMatch}
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : {}}
                  transition={{ duration: 0.3, delay: STEP_DELAY.COMPARE + index * 0.1 }}
                >
                  <MatchBadge score={offer.score} label={offer.label} size="sm" />
                  <ul className={styles.offerReasons}>
                    {offer.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </motion.div>

                {offer.top && (
                  <motion.span
                    className={styles.connectedBadge}
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
