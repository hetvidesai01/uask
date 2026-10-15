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
            UASK is a reverse marketplace. Instead of scrolling through profiles, you tell us what you need and
            professionals who fit send you offers. You compare them and choose who you want to work with.
          </p>
        </Reveal>

        <Reveal as="section" className={styles.section}>
          <h2 className={styles.h2}>Why UASK</h2>
          <p className={styles.body}>
            Finding the right professional usually means checking several platforms and explaining the same thing
            again and again. With UASK, you describe the job once and the right people reply.
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
            We want finding and working with the right professional to feel simple, quick and honest.
          </p>
        </Reveal>

        <Reveal>
          <ContactSection />
        </Reveal>
      </RevealGroup>
    </div>
  )
}
