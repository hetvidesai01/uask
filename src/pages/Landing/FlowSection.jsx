import SignalRail from '../../components/ui/SignalRail'
import styles from './FlowSection.module.css'

const STEPS = [
  { label: 'ASK', description: 'Post what you need in a couple of minutes.' },
  { label: 'MATCH', description: 'Relevant providers see your ASK right away.' },
  { label: 'RESPOND', description: 'They send offers with price and timeline.' },
  { label: 'COMPARE', description: 'Line every offer up side by side.' },
  { label: 'CONNECT', description: 'Pick one and start the work.' },
]

export default function FlowSection() {
  return (
    <section id="how-it-works" className={`section ${styles.flow}`}>
      <div className="container">
        <h2 className={styles.heading}>How UASK works</h2>
        <SignalRail steps={STEPS} />
      </div>
    </section>
  )
}
