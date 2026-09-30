import { motion } from 'framer-motion'
import { useInView } from '../../hooks/useInView'
import StaggerReveal from '../../components/ui/StaggerReveal'
import { SOFT_SPRING, staggerContainer, staggerItem } from '../../utils/motion'
import styles from './GuideSection.module.css'

export default function GuideSection({ id, kicker, heading, intro, steps, tone = 'default' }) {
  const [ref, isInView] = useInView({ threshold: 0.1 })

  return (
    <section id={id} className={`section ${styles.section}`}>
      <div className="container">
        <StaggerReveal>
          <motion.span className={styles.kicker} variants={staggerItem}>
            {kicker}
          </motion.span>
          <motion.h2 className={styles.heading} variants={staggerItem}>
            {heading}
          </motion.h2>
          <motion.p className={styles.intro} variants={staggerItem}>
            {intro}
          </motion.p>
        </StaggerReveal>

        <motion.ol
          ref={ref}
          className={styles.list}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={staggerContainer}
        >
          {steps.map((step, index) => (
            <motion.li
              key={step.title}
              className={[styles.card, tone === 'provider' ? styles.provider : ''].filter(Boolean).join(' ')}
              variants={staggerItem}
              whileHover={{ y: -3, transition: SOFT_SPRING }}
            >
              <span className={styles.number} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <p className={styles.cardTitle}>{step.title}</p>
                <p className={styles.cardBody}>{step.body}</p>
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  )
}
