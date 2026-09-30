import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Reveal, RevealGroup } from '../../components/ui/Reveal'
import AskCard from '../../components/ask/AskCard'
import AskFilters from '../../components/ask/AskFilters'
import RecommendedAskCard from '../../components/matching/RecommendedAskCard'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import Button from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { getAsks, getCategories } from '../../services/askService'
import { getUserById } from '../../services/authService'
import { getRecommendedAsksForProvider } from '../../services/matchingService'
import styles from './DiscoverAsks.module.css'

const FILTER_KEYS = ['category', 'status', 'isRemote', 'location', 'budgetMin', 'budgetMax', 'postedWithin']

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'budget_high', label: 'Budget: high to low' },
  { value: 'budget_low', label: 'Budget: low to high' },
  { value: 'deadline_soon', label: 'Deadline: soonest' },
]

// Cards past this position all share the same short stagger delay, so a
// large result page doesn't turn into a long tail of waiting.
const MAX_STAGGER_STEPS = 8

export default function DiscoverAsksTab() {
  const { user, activeRole } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [asks, setAsks] = useState([])
  const [requestersById, setRequestersById] = useState({})
  const [status, setStatus] = useState('loading')
  const [recommended, setRecommended] = useState([])
  const [recommendedStatus, setRecommendedStatus] = useState('idle')

  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) || '']))
  const sort = searchParams.get('sort') || 'newest'

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  // Provider-only, independent of filters/sort below — "Recommended for
  // you" is a separate ranked shortlist, not a replacement for Discover's
  // own filtering. See services/matchingService.js.
  useEffect(() => {
    if (activeRole !== 'provider') {
      setRecommended([])
      setRecommendedStatus('idle')
      return
    }

    let cancelled = false
    setRecommendedStatus('loading')
    getRecommendedAsksForProvider(user.id, { limit: 4 })
      .then((results) => {
        if (cancelled) return
        setRecommended(results)
        setRecommendedStatus('done')
      })
      .catch(() => {
        if (!cancelled) setRecommendedStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [activeRole, user.id])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    const query = {
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      sort,
    }
    if (query.isRemote !== undefined) query.isRemote = query.isRemote === 'true'
    if (query.budgetMin !== undefined) query.budgetMin = Number(query.budgetMin)
    if (query.budgetMax !== undefined) query.budgetMax = Number(query.budgetMax)

    getAsks(query)
      .then(async (result) => {
        if (cancelled) return
        const requesterIds = [...new Set(result.map((ask) => ask.requesterId))]
        const requesters = await Promise.all(requesterIds.map((id) => getUserById(id)))
        if (cancelled) return
        setRequestersById(Object.fromEntries(requesters.filter(Boolean).map((user) => [user.id, user])))
        setAsks(result)
        setStatus('done')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams)
    FILTER_KEYS.forEach((key) => next.delete(key))
    setSearchParams(next, { replace: true })
  }

  return (
    <div className={styles.results}>
      {activeRole === 'provider' && recommendedStatus === 'done' && recommended.length > 0 && (
        <section className={styles.recommended}>
          <div className={styles.recommendedHeader}>
            <h2 className={styles.recommendedTitle}>Recommended for you</h2>
            <p className={styles.recommendedSubtitle}>
              Ranked by fit to your skills, rating and track record — not a guarantee, just a starting point.
            </p>
          </div>
          <RevealGroup className={styles.recommendedGrid}>
            {recommended.map((match) => (
              <Reveal key={match.ask.id}>
                <RecommendedAskCard match={match} />
              </Reveal>
            ))}
          </RevealGroup>
        </section>
      )}

      <div className={styles.resultsHeader}>
        <motion.span
          key={status === 'done' ? asks.length : 'loading'}
          className={styles.count}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {status === 'done' ? `${asks.length} ${asks.length === 1 ? 'ASK' : 'ASKs'} found` : ' '}
        </motion.span>
        <div className={styles.controls}>
          <AskFilters
            categories={categories}
            filters={filters}
            onFilterChange={updateFilter}
            onReset={resetFilters}
          />
          <Select
            className={styles.sort}
            label="Sort by"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(e) => updateFilter('sort', e.target.value)}
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
          <EmptyState
            icon="⚠️"
            title="Couldn't load ASKs"
            message="Something went wrong loading results. Please try again."
            action={
              <Button variant="secondary" onClick={() => setSearchParams(new URLSearchParams(searchParams))}>
                Retry
              </Button>
            }
          />
        </div>
      )}

      {status === 'done' && asks.length === 0 && (
        <div className={styles.centered}>
          <EmptyState
            icon="🔍"
            title="No ASKs match your filters"
            message="Try widening your search or clearing a few filters."
            action={
              <Button variant="secondary" onClick={resetFilters}>
                Clear all filters
              </Button>
            }
          />
        </div>
      )}

      {status === 'done' && asks.length > 0 && (
        <div className={styles.grid}>
          <AnimatePresence mode="popLayout">
            {asks.map((ask, index) => (
              <motion.div
                key={ask.id}
                layout
                initial={{ opacity: 0, y: 26, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  duration: 0.45,
                  delay: Math.min(index, MAX_STAGGER_STEPS) * 0.07,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <AskCard ask={ask} requester={requestersById[ask.requesterId]} editorial />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
