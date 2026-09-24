import { motion } from 'framer-motion'
import { useInView } from '../../hooks/useInView'
import { staggerContainer, staggerItem } from '../../utils/motion'
import styles from './ReverseMarketplaceSection.module.css'

const OLD_WAY = ['Search', 'Scroll', 'Message', 'Wait']
const UASK_WAY = ['ASK', 'Let relevant people come to you']

export default function ReverseMarketplaceSection() {
  const [ref, isInView] = useInView()

  return (
    <section className="section">
      <div className="container">
        <h2 className={styles.heading}>This isn&apos;t another listings board.</h2>
        <p className={styles.lead}>Most marketplaces make you go find people. UASK flips it.</p>

        <motion.div
          ref={ref}
          className={styles.contrast}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={staggerContainer}
          transition={{ staggerChildren: 0.2 }}
        >
          <motion.div className={[styles.panel, styles.old].join(' ')} variants={staggerItem}>
            <p className={styles.panelLabel}>The traditional way</p>
            <div className={styles.chain}>
              {OLD_WAY.map((step, index) => (
                <span key={step} className={styles.chainItem}>
                  <span className={styles.oldChip}>{step}</span>
                  {index < OLD_WAY.length - 1 && (
                    <span className={styles.chainArrow} aria-hidden="true">
                      →
                    </span>
                  )}
                </span>
              ))}
            </div>
          </motion.div>

          <div className={styles.divider} aria-hidden="true">
            vs
          </div>

          <motion.div className={[styles.panel, styles.uask].join(' ')} variants={staggerItem}>
            <p className={styles.panelLabel}>The UASK way</p>
            <div className={styles.chain}>
              {UASK_WAY.map((step, index) => (
                <span key={step} className={styles.chainItem}>
                  <span className={styles.uaskChip}>{step}</span>
                  {index < UASK_WAY.length - 1 && (
                    <span className={styles.chainArrowRed} aria-hidden="true">
                      →
                    </span>
                  )}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
