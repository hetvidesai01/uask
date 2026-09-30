import { Reveal, RevealGroup } from '../../components/ui/Reveal'
import SignalMark from '../../components/ui/SignalMark'
import ContactSection from './ContactSection'
import styles from './About.module.css'

const FLOW = ['ASK', 'MATCH', 'RESPOND', 'COMPARE', 'CONNECT']

export default function About() {
  return (
    <div className={styles.page}>
      {/* Faint decorative signal graphics in the side gutters (wide screens only). */}
      <div className={styles.sideGraphics} aria-hidden="true">
        <SignalMark size="lg" rings={3} className={styles.signalLeft} />
        <SignalMark size="lg" rings={3} className={styles.signalRight} />
      </div>

      <RevealGroup className={styles.content}>
        <Reveal as="section" className={styles.hero}>
          <h1 className={styles.h1}>About UASK</h1>
          <p className={styles.lead}>
            UASK is a reverse marketplace. Instead of searching through profiles, you post what you need and relevant
            professionals come to you with an offer. You compare the responses and choose who to work with.
          </p>
        </Reveal>

        <Reveal as="section" className={styles.section}>
          <h2 className={styles.h2}>Why UASK</h2>
          <p className={styles.body}>
            Finding the right professional means searching many platforms and repeating yourself everywhere. UASK flips
            it: describe the job once, and the right people respond.
          </p>
          <ol className={styles.flow} aria-label="How UASK works">
            {FLOW.map((step, index) => (
              <li key={step} className={styles.flowStep}>
                <span className={styles.flowLabel}>{step}</span>
                {index < FLOW.length - 1 && (
                  <span className={styles.flowArrow} aria-hidden="true">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal as="section" className={styles.section}>
          <h2 className={styles.h2}>Our Vision</h2>
          <p className={styles.body}>
            To make finding and working with the right professional simpler, faster and more transparent.
          </p>
        </Reveal>

        <Reveal>
          <ContactSection />
        </Reveal>
      </RevealGroup>
    </div>
  )
}
