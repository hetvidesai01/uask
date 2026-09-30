import { motion } from 'framer-motion'
import Avatar from '../../components/ui/Avatar'
import StaggerReveal from '../../components/ui/StaggerReveal'
import TiltCard from '../../components/ui/TiltCard'
import { SOFT_SPRING, staggerItem } from '../../utils/motion'
import styles from './TestimonialsSection.module.css'

// DEMO content only — illustrative, clearly labelled on the page, and not
// from verified users. Replace with real testimonials before launch.
const TESTIMONIALS = [
  {
    name: 'Aarav S.',
    role: 'Student Founder',
    quote:
      'Instead of searching through dozens of profiles, I posted what I needed and compared the people who actually wanted the project.',
  },
  {
    name: 'Meera K.',
    role: 'Freelance Designer',
    quote: 'I only see ASKs that fit my work, so I spend my time writing good offers instead of hunting for leads.',
  },
  {
    name: 'Rohan D.',
    role: 'Photographer',
    quote: 'The ASK already had the budget and timeline in it, so my first reply could be specific.',
  },
  {
    name: 'Isha P.',
    role: 'Small Business Owner',
    quote: 'Seeing three offers side by side made the decision easy, and I still got to pick who I trusted.',
  },
]

// Same fade + rise as the shared stagger item, with a very slight scale-in.
const cardVariants = {
  hidden: { ...staggerItem.hidden, scale: 0.97 },
  visible: {
    ...staggerItem.visible,
    scale: 1,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
}

export default function TestimonialsSection() {
  return (
    <section className={`section ${styles.section}`} aria-labelledby="testimonials-heading">
      {/* Decorative ambient layer: behind content, non-interactive, asymmetric. */}
      <div className={styles.ambient} aria-hidden="true">
        <span className={`${styles.blob} ${styles.blobA}`} />
        <span className={`${styles.blob} ${styles.blobB}`} />
        <span className={`${styles.ring} ${styles.ringA}`} />
        <span className={`${styles.ring} ${styles.ringB}`} />
        <span className={`${styles.dot} ${styles.dotA}`} />
        <span className={`${styles.dot} ${styles.dotB}`} />
        <span className={`${styles.dot} ${styles.dotC}`} />
        <svg className={styles.curves} viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className={styles.curve} d="M 2,78 Q 22,58 40,74" />
          <path className={styles.curve} d="M 60,12 Q 82,4 98,26" />
        </svg>
      </div>

      <div className={`container ${styles.inner}`}>
        <div className={styles.headingRow}>
          <h2 id="testimonials-heading" className={styles.heading}>
            Early feedback
          </h2>
          <p className={styles.note}>Demo testimonials, shown for illustration only.</p>
        </div>

        <StaggerReveal className={styles.grid} threshold={0.2}>
          {TESTIMONIALS.map((item) => (
            <motion.div key={item.name} variants={cardVariants} whileHover={{ y: -4 }} transition={SOFT_SPRING}>
              <TiltCard maxTilt={1.5}>
                <figure className={styles.card}>
                  <span className={styles.quoteMark} aria-hidden="true">
                    “
                  </span>
                  <blockquote className={styles.quote}>{item.quote}</blockquote>
                  <figcaption className={styles.person}>
                    <Avatar name={item.name} size="sm" />
                    <span className={styles.personText}>
                      <span className={styles.name}>{item.name}</span>
                      <span className={styles.role}>{item.role}</span>
                    </span>
                  </figcaption>
                </figure>
              </TiltCard>
            </motion.div>
          ))}
        </StaggerReveal>
      </div>
    </section>
  )
}
