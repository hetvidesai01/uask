import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Tabs from '../../components/ui/Tabs'
import AskCard from '../../components/ask/AskCard'
import PersonCard from '../../components/people/PersonCard'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { searchAsks, searchPeople } from '../../services/searchService'
import { getProviderReputation } from '../../services/contractService'
import styles from './SearchResults.module.css'

const TAB_ITEMS = [
  { id: 'all', label: 'All' },
  { id: 'asks', label: 'ASKs' },
  { id: 'people', label: 'People' },
]

const PREVIEW_COUNT = 6

async function loadReputationById(people) {
  const providers = people.filter((person) => person.roles?.includes('provider'))
  const results = await Promise.all(providers.map((person) => getProviderReputation(person.id)))
  return Object.fromEntries(providers.map((person, index) => [person.id, results[index]]))
}

export default function SearchResults() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const activeTab = searchParams.get('tab') ?? 'all'

  const [status, setStatus] = useState('loading')
  const [asks, setAsks] = useState([])
  const [people, setPeople] = useState([])
  const [reputationById, setReputationById] = useState({})

  useEffect(() => {
    if (!query.trim()) {
      setAsks([])
      setPeople([])
      setStatus('empty_query')
      return
    }

    let cancelled = false
    setStatus('loading')

    Promise.all([searchAsks(query), searchPeople(query, { excludeUserId: user.id })])
      .then(async ([askResults, peopleResults]) => {
        if (cancelled) return
        const reputation = await loadReputationById(peopleResults)
        if (cancelled) return
        setAsks(askResults)
        setPeople(peopleResults)
        setReputationById(reputation)
        setStatus('done')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [query, user.id])

  function handleTabChange(tabId) {
    const next = new URLSearchParams(searchParams)
    if (tabId === 'all') next.delete('tab')
    else next.set('tab', tabId)
    setSearchParams(next, { replace: true })
  }

  const noResults = status === 'done' && asks.length === 0 && people.length === 0

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Search results</h1>
        {query.trim() && <p className={styles.subtitle}>Showing results for &quot;{query}&quot;</p>}
      </div>

      {status !== 'empty_query' && (
        <Tabs items={TAB_ITEMS} active={activeTab} onChange={handleTabChange} />
      )}

      {status === 'empty_query' && (
        <EmptyState icon="🔍" title="Search UASK" message="Enter a term in the search bar to find ASKs, people or skills." />
      )}

      {status === 'loading' && (
        <div className={styles.centered}>
          <Spinner size="lg" />
        </div>
      )}

      {status === 'error' && (
        <EmptyState
          icon="⚠️"
          title="Couldn't load results"
          message="Something went wrong running this search. Please try again."
        />
      )}

      {noResults && (
        <EmptyState
          icon="🔍"
          title="No results"
          message={`Nothing matched "${query}" in ASKs or people. Try a different term.`}
        />
      )}

      {status === 'done' && !noResults && (
        <div className={styles.results}>
          {(activeTab === 'all' || activeTab === 'asks') && asks.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>ASKs</h2>
                {activeTab === 'all' && asks.length > PREVIEW_COUNT && (
                  <Button variant="ghost" size="sm" onClick={() => handleTabChange('asks')}>
                    View all {asks.length} ASKs
                  </Button>
                )}
              </div>
              <div className={styles.askGrid}>
                {(activeTab === 'all' ? asks.slice(0, PREVIEW_COUNT) : asks).map((ask) => (
                  <AskCard key={ask.id} ask={ask} />
                ))}
              </div>
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'people') && people.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>People</h2>
                {activeTab === 'all' && people.length > PREVIEW_COUNT && (
                  <Button variant="ghost" size="sm" onClick={() => handleTabChange('people')}>
                    View all {people.length} people
                  </Button>
                )}
              </div>
              <div className={styles.peopleGrid}>
                {(activeTab === 'all' ? people.slice(0, PREVIEW_COUNT) : people).map((person) => (
                  <PersonCard
                    key={person.id}
                    user={person}
                    currentUserId={user.id}
                    rating={reputationById[person.id]?.averageRating ?? person.rating}
                    completedContractCount={reputationById[person.id]?.completedContractCount ?? 0}
                  />
                ))}
              </div>
            </section>
          )}

          {activeTab === 'asks' && asks.length === 0 && (
            <EmptyState icon="🗂️" title="No ASKs matched" message={`Nothing in ASKs matched "${query}".`} />
          )}

          {activeTab === 'people' && people.length === 0 && (
            <EmptyState icon="👤" title="No people matched" message={`Nobody matched "${query}".`} />
          )}
        </div>
      )}
    </div>
  )
}
