import { useSearchParams } from 'react-router-dom'
import Tabs from '../../components/ui/Tabs'
import { motion } from 'framer-motion'
import { Reveal, RevealGroup } from '../../components/ui/Reveal'
import DiscoverAsksTab from './DiscoverAsksTab'
import DiscoverPeopleTab from './DiscoverPeopleTab'
import styles from './DiscoverAsks.module.css'

const TAB_ITEMS = [
  { id: 'asks', label: 'ASKs' },
  { id: 'people', label: 'People' },
]

// Discover ASKs and Discover People live in one shell (tabs), per the
// product decision to extend Discover rather than add an unrelated section.
export default function Discover() {
  const [searchParams, setSearchParams] = useSearchParams()

  const requestedTab = searchParams.get('type')
  // ASKs is always the default landing tab — People stays one click away
  // as the secondary tab, reachable via the ?type=people query param.
  const activeTab = requestedTab === 'people' || requestedTab === 'asks' ? requestedTab : 'asks'

  function handleTabChange(tabId) {
    const next = new URLSearchParams(searchParams)
    next.set('type', tabId)
    setSearchParams(next, { replace: true })
  }

  return (
    <RevealGroup className={styles.page}>
      <Reveal className={styles.header}>
        <h1 className={styles.title}>Discover</h1>
        <p className={styles.subtitle}>Discover open ASKs, or explore professional profiles to connect with.</p>
      </Reveal>

      <Reveal>
        <Tabs items={TAB_ITEMS} active={activeTab} onChange={handleTabChange} />
      </Reveal>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {activeTab === 'asks' ? <DiscoverAsksTab /> : <DiscoverPeopleTab />}
      </motion.div>
    </RevealGroup>
  )
}
