import { motion } from 'framer-motion'
import AnimatedBackground from '../../ui/AnimatedBackground'
import SignalMark from '../../ui/SignalMark'
import { revealGroup, revealItem } from '../../../utils/motion'
import styles from './AuthLayout.module.css'

// The ASK -> RESPOND -> COMPARE -> CONNECT story, kept abstract: four small
// cards on a curved line. Decorative only (aria-hidden), desktop only.
const STORY = [
  { step: 'ASK', line: 'Post what you need' },
  { step: 'RESPOND', line: 'Offers come to you' },
  { step: 'COMPARE', line: 'See them side by side' },
  { step: 'CONNECT', line: 'Choose who to work with' },
]

// Shared frame for Log in / Sign up: the form card is the main focus (first
// in reading order), with a branded visual story beside it on wide screens.
// `children` is the <form>; `footer` is the secondary cross-link line.
export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className={styles.page}>
      {/* Existing ambient system: soft blobs, faint rings, dots and lines. */}
      <AnimatedBackground variant="shell" />

      <div className={`container ${styles.grid}`}>
        <motion.div
          className={styles.formCard}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.header}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>

          {children}

          <p className={styles.footer}>{footer}</p>
        </motion.div>

        <div className={styles.story} aria-hidden="true">
          <SignalMark size="lg" rings={3} className={styles.storyMark} />
          <svg className={styles.storyLine} viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 12,8 C 60,18 10,40 58,52 S 20,80 78,92" />
          </svg>
          <motion.ol className={styles.storyList} initial="hidden" animate="visible" variants={revealGroup}>
            {STORY.map((item, index) => (
              <motion.li
                key={item.step}
                className={[styles.storyCard, styles[`storyCard${index}`]].join(' ')}
                variants={revealItem}
              >
                <span className={styles.storyStep}>{item.step}</span>
                <span className={styles.storyLineText}>{item.line}</span>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </div>
    </div>
  )
}
