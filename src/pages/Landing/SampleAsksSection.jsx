import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Tag from '../../components/ui/Tag'
import { useInView } from '../../hooks/useInView'
import styles from './SampleAsksSection.module.css'

// Static examples for the landing page only — not wired to services/mocks.
const SAMPLE_ASKS = [
  {
    title: 'Logo for a new bakery',
    category: 'Design',
    status: 'open',
    budget: '$300–$500',
    timeline: '1 week',
    tags: ['Remote'],
    requester: 'Priya K.',
  },
  {
    title: 'Rewrite my product landing page',
    category: 'Writing',
    status: 'matched',
    budget: '$150–$250',
    timeline: '3 days',
    tags: ['Remote', 'Urgent'],
    requester: 'Sam T.',
  },
  {
    title: 'Fix a checkout bug on my store',
    category: 'Development',
    status: 'open',
    budget: '$400–$800',
    timeline: '2 weeks',
    tags: ['Remote'],
    requester: 'Jordan L.',
  },
]

export default function SampleAsksSection() {
  const [ref, isInView] = useInView()

  return (
    <section className={`section ${styles.sampleAsks}`}>
      <div className="container">
        <h2 className={styles.heading}>Real ASKs, real momentum</h2>

        <div ref={ref} className={styles.grid}>
          {SAMPLE_ASKS.map((ask, index) => (
            <Card
              key={ask.title}
              hoverable
              className={`reveal ${isInView ? 'isVisible' : ''} ${styles.card}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className={styles.cardHeader}>
                <p className={styles.title}>{ask.title}</p>
                <Badge variant={ask.status}>{ask.status === 'open' ? 'Open' : 'Matched'}</Badge>
              </div>

              <p className={styles.meta}>
                {ask.category} · {ask.budget} · {ask.timeline}
              </p>

              <div className={styles.tags}>
                {ask.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>

              <div className={styles.requester}>
                <Avatar name={ask.requester} size="sm" />
                <span>{ask.requester}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
