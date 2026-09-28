import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import PersonCard from '../../components/people/PersonCard'
import { useAuth } from '../../hooks/useAuth'
import { getCategories } from '../../services/askService'
import { getAllUsers } from '../../services/authService'
import { getProviderReputation } from '../../services/contractService'
import styles from './DiscoverAsks.module.css'

async function loadReputationById(people) {
  const providers = people.filter((person) => person.roles?.includes('provider'))
  const results = await Promise.all(providers.map((person) => getProviderReputation(person.id)))
  return Object.fromEntries(providers.map((person, index) => [person.id, results[index]]))
}

export default function DiscoverPeopleTab() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('personCategory') || ''

  const [categories, setCategories] = useState([])
  const [people, setPeople] = useState([])
  const [reputationById, setReputationById] = useState({})
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    getAllUsers()
      .then(async (allUsers) => {
        const filtered = allUsers.filter((person) => {
          if (person.id === user.id) return false
          if (category && !person.categories?.includes(category)) return false
          return true
        })
        const reputation = await loadReputationById(filtered)
        if (cancelled) return
        setPeople(filtered)
        setReputationById(reputation)
        setStatus('done')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [category, user.id])

  function handleCategoryChange(value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('personCategory', value)
    else next.delete('personCategory')
    setSearchParams(next, { replace: true })
  }

  const categoryOptions = [
    { value: '', label: 'Any category' },
    ...categories.map((c) => ({ value: c.label, label: c.label })),
  ]

  return (
    <div className={styles.results}>
      <div className={styles.resultsHeader}>
        <span className={styles.count}>
          {status === 'done' ? `${people.length} ${people.length === 1 ? 'person' : 'people'} found` : ' '}
        </span>
        <div className={styles.controls}>
          <Select
            className={styles.sort}
            label="Category"
            options={categoryOptions}
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
          />
        </div>
      </div>

      {status === 'loading' && (
        <div className={styles.centered}>
          <Spinner size="lg" />
        </div>
      )}

      {status === 'error' && (
        <div className={styles.centered}>
          <EmptyState icon="⚠️" title="Couldn't load people" message="Something went wrong. Please try again." />
        </div>
      )}

      {status === 'done' && people.length === 0 && (
        <div className={styles.centered}>
          <EmptyState
            icon="👤"
            title="No one matches yet"
            message="Try a different category, or check back once more people join."
          />
        </div>
      )}

      {status === 'done' && people.length > 0 && (
        <div className={styles.grid}>
          {people.map((person) => (
            <PersonCard
              key={person.id}
              user={person}
              currentUserId={user.id}
              rating={reputationById[person.id]?.averageRating ?? person.rating}
              completedContractCount={reputationById[person.id]?.completedContractCount ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
