import { useSearchParams } from 'react-router-dom'
import Tabs from '../../components/ui/Tabs'
import AnimatedBackground from '../../components/ui/AnimatedBackground'
import DiscoverAsksTab from './DiscoverAsksTab'
import DiscoverPeopleTab from './DiscoverPeopleTab'
import { useAuth } from '../../hooks/useAuth'
import styles from './DiscoverAsks.module.css'

const TAB_ITEMS = [
  { id: 'asks', label: 'ASKs' },
  { id: 'people', label: 'People' },
]

// Discover ASKs and Discover People live in one shell (tabs), per the
// product decision to extend Discover rather than add an unrelated section.
export default function Discover() {
  const { activeRole } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const requestedTab = searchParams.get('type')
  // Provider mode naturally emphasizes ASKs, Seeker mode emphasizes People —
  // only as the default landing tab; both stay one click away either way.
  const defaultTab = activeRole === 'seeker' ? 'people' : 'asks'
  const activeTab = requestedTab === 'people' || requestedTab === 'asks' ? requestedTab : defaultTab

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
