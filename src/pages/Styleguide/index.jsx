import { useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  StatCard,
  Tabs,
  Tag,
  Textarea,
} from '../../components/ui'
import styles from './Styleguide.module.css'

const CATEGORY_OPTIONS = [
  { value: 'design', label: 'Design' },
  { value: 'writing', label: 'Writing' },
  { value: 'development', label: 'Development' },
]

const TAB_ITEMS = [
  { id: 'asks', label: 'My ASKs' },
  { id: 'offers', label: 'My Offers' },
  { id: 'activity', label: 'Recent activity' },
]

export default function Styleguide() {
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('asks')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState(['Remote', 'Urgent', 'Budget-friendly'])

  const removeTag = (tagToRemove) => {
    setTags((current) => current.filter((tag) => tag !== tagToRemove))
  }

  return (
    <div className="container">
      <div className={styles.page}>
        <div className={styles.section}>
          <h1>UASK Styleguide</h1>
          <p style={{ color: 'var(--c-text-mute)' }}>
            Temporary route — every UI kit component and its main variants, for visual
            inspection. Removed before launch.
          </p>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Button</h2>
          <div className={styles.row}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div className={styles.row}>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className={styles.row}>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button fullWidth>Full width</Button>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Input</h2>
          <div className={styles.grid}>
            <Input label="ASK title" placeholder="e.g. Logo for my bakery" />
            <Input label="Budget" hint="In USD, before fees" placeholder="500" />
            <Input label="Email" error="Please enter a valid email" defaultValue="not-an-email" />
            <Input label="Search" icon="🔍" placeholder="Search ASKs" />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Textarea</h2>
          <div className={styles.grid}>
            <Textarea
              label="Description"
              maxLength={120}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What do you need help with?"
            />
            <Textarea label="Notes" error="This field is required" />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Select</h2>
          <div className={styles.grid}>
            <Select label="Category" options={CATEGORY_OPTIONS} />
            <Select label="Category" options={CATEGORY_OPTIONS} error="Please choose a category" />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Card</h2>
          <div className={styles.grid}>
            <Card padding="sm">Small padding</Card>
            <Card padding="md">Medium padding</Card>
            <Card padding="lg" hoverable>
              Large padding, hoverable
            </Card>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Badge</h2>
          <div className={styles.row}>
            <Badge variant="open">Open</Badge>
            <Badge variant="matched">Matched</Badge>
            <Badge variant="in_review">In review</Badge>
            <Badge variant="closed">Closed</Badge>
            <Badge variant="accepted">Accepted</Badge>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Avatar</h2>
          <div className={styles.row}>
            <Avatar name="Priya Kothari" size="sm" />
            <Avatar name="Priya Kothari" size="md" />
            <Avatar name="Priya Kothari" size="lg" />
            <Avatar name="Sam" size="md" />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Spinner</h2>
          <div className={styles.row}>
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>EmptyState</h2>
          <Card padding="lg">
            <EmptyState
              icon="📭"
              title="No ASKs yet"
              message="Post your first ASK and providers will start sending offers."
              action={<Button variant="primary">Post an ASK</Button>}
            />
          </Card>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Modal</h2>
          <div className={styles.row}>
            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          </div>
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Delete ASK">
            <p style={{ marginBottom: 'var(--sp-4)' }}>
              Are you sure you want to delete this ASK? This can't be undone.
            </p>
            <div className={styles.row}>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => setModalOpen(false)}>
                Delete ASK
              </Button>
            </div>
          </Modal>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tabs</h2>
          <Tabs items={TAB_ITEMS} active={activeTab} onChange={setActiveTab} />
          <p style={{ color: 'var(--c-text-mute)' }}>Active tab: {activeTab}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tag</h2>
          <div className={styles.row}>
            {tags.map((tag) => (
              <Tag key={tag} onRemove={() => removeTag(tag)}>
                {tag}
              </Tag>
            ))}
            <Tag>Not removable</Tag>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>StatCard</h2>
          <div className={styles.grid}>
            <StatCard label="Open ASKs" value="4" delta={12} />
            <StatCard label="Offers received" value="9" delta={-5} />
            <StatCard label="Response rate" value="87%" />
          </div>
        </section>
      </div>
    </div>
  )
}
