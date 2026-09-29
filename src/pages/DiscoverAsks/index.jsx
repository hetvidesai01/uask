import { useSearchParams } from 'react-router-dom'
import Tabs from '../../components/ui/Tabs'
import AnimatedBackground from '../../components/ui/AnimatedBackground'
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
    <div className={styles.page}>
      <AnimatedBackground variant="quiet" />
      <div className={styles.header}>
        <h1 className={styles.title}>Discover</h1>
        <p className={styles.subtitle}>Discover open ASKs, or explore professional profiles to connect with.</p>
      </div>

      <Tabs items={TAB_ITEMS} active={activeTab} onChange={handleTabChange} />

      {activeTab === 'asks' ? <DiscoverAsksTab /> : <DiscoverPeopleTab />}
    </div>
  )
}
