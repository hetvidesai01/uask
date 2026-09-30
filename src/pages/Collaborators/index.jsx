import { Reveal, RevealGroup } from '../../components/ui/Reveal'
import CollaboratorCard from './CollaboratorCard'
import styles from './Collaborators.module.css'

// Placeholder data only — clearly not real partnerships. Replace with real
// collaborators (and add `href` where they have a site) before launch.
const COLLABORATORS = [
  { name: 'Community Partner', type: 'Community Partner', description: 'Placeholder — a local community that helps its members find trusted professionals.' },
  { name: 'Creative Partner', type: 'Creative Partner', description: 'Placeholder — a creative collective working with designers, writers and makers.' },
  { name: 'Technology Partner', type: 'Technology Partner', description: 'Placeholder — a tools and platform partner supporting how UASK works.' },
  { name: 'Campus Partner', type: 'Campus Partner', description: 'Placeholder — a college network connecting students with real project work.' },
  { name: 'Brand Partner', type: 'Brand Partner', description: 'Placeholder — a brand that hires and champions independent professionals.' },
  { name: 'Community Partner Two', type: 'Community Partner', description: 'Placeholder — another community sharing the goal of better professional matches.' },
]

export default function Collaborators() {
  return (
    <div className={styles.page}>
      <RevealGroup className={styles.content}>
        <Reveal as="section" className={styles.hero}>
          <h1 className={styles.h1}>Collaborators</h1>
          <p className={styles.lead}>
            UASK works with communities, creators, organisations and partners who share one goal: connecting people
            with the right professionals.
          </p>
        </Reveal>

        <RevealGroup className={styles.grid}>
          {COLLABORATORS.map((collaborator) => (
            <CollaboratorCard key={collaborator.name} {...collaborator} />
          ))}
        </RevealGroup>
      </RevealGroup>
    </div>
  )
}
