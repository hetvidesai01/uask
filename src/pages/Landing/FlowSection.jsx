import { useInView } from '../../hooks/useInView'
import styles from './FlowSection.module.css'

const STEPS = [
  { label: 'ASK', description: 'Post what you need in a couple of minutes.' },
  { label: 'MATCH', description: 'Relevant providers see your ASK right away.' },
  { label: 'RESPOND', description: 'They send offers with price and timeline.' },
  { label: 'COMPARE', description: 'Line every offer up side by side.' },
  { label: 'CONNECT', description: 'Pick one and start the work.' },
]

export default function FlowSection() {
  const [ref, isInView] = useInView()

  return (
    <section id="how-it-works" className={`section ${styles.flow}`}>
      <div className="container">
        <h2 className={styles.heading}>How UASK works</h2>

        <div ref={ref} className={styles.steps}>
          {STEPS.map((step, index) => (
            <div
              key={step.label}
              className={`reveal ${isInView ? 'isVisible' : ''} ${styles.step}`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <span className={styles.number}>{index + 1}</span>
              <div>
                <p className={styles.label}>{step.label}</p>
                <p className={styles.description}>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
