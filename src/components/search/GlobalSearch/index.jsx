import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../../ui/Avatar'
import { useAuth } from '../../../hooks/useAuth'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { searchAll } from '../../../services/searchService'
import { getProfileHeadline } from '../../../utils/profileHeadline'
import { formatBudgetRange } from '../../../utils/formatCurrency'
import styles from './GlobalSearch.module.css'

const GROUP_LABELS = { asks: 'ASKs', people: 'People' }
const RESULT_LIMIT = 4

// Compact topbar search — ASKs, people and skills/categories in one field.
// Frontend/mock only (see services/searchService.js); no external search
// engine. Grouped dropdown result count is capped via RESULT_LIMIT per
// group; "View all results" hands off to the full /app/search page.
export default function GlobalSearch() {
  const { user, activeRole } = useAuth()
  const navigate = useNavigate()

  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState({ asks: [], people: [] })
  const [loading, setLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const rootRef = useRef(null)

  const term = useDebouncedValue(value.trim(), 250)

  useEffect(() => {
    if (!term) {
      setResults({ asks: [], people: [] })
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    searchAll(term, { limit: RESULT_LIMIT, excludeUserId: user.id }).then((result) => {
      if (cancelled) return
      setResults(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [term, user.id])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  // Seeker mode naturally surfaces People first, Provider mode surfaces
  // ASKs first — neither group is ever hidden, this only reorders them.
  const groupOrder = activeRole === 'seeker' ? ['people', 'asks'] : ['asks', 'people']

  const flatResults = []
  groupOrder.forEach((type) => {
    results[type].forEach((item) => flatResults.push({ type, item }))
  })
  const hasResults = flatResults.length > 0

  function reset() {
    setOpen(false)
    setValue('')
    setHighlightedIndex(-1)
  }

  function goToAsk(ask) {
    reset()
    navigate(`/app/asks/${ask.id}`)
  }

  function goToPerson(person) {
    reset()
    navigate(`/app/profile/${person.id}`)
  }

  function goToFullResults() {
    if (!term) return
    setOpen(false)
    navigate(`/app/search?q=${encodeURIComponent(term)}`)
  }

  function handleChange(event) {
    setValue(event.target.value)
    setOpen(true)
    setHighlightedIndex(-1)
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!hasResults && event.key !== 'Enter') return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHighlightedIndex((index) => (index + 1) % flatResults.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setHighlightedIndex((index) => (index - 1 + flatResults.length) % flatResults.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const entry = flatResults[highlightedIndex]
      if (!entry) {
        goToFullResults()
      } else if (entry.type === 'asks') {
        goToAsk(entry.item)
      } else {
        goToPerson(entry.item)
      }
    }
  }

  let runningIndex = -1

  return (
    <div className={styles.root} ref={rootRef}>
      <span className={styles.icon} aria-hidden="true">
        🔍
      </span>
      <label htmlFor="global-search" className="sr-only">
        Search ASKs, people or skills
      </label>
      <input
        id="global-search"
        type="search"
        className={styles.input}
        placeholder="Search UASK"
        value={value}
        onChange={handleChange}
        onFocus={() => term && setOpen(true)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="global-search-results"
        autoComplete="off"
      />

      {open && term && (
        <div id="global-search-results" className={styles.dropdown} role="listbox">
          {loading ? (
            <p className={styles.status}>Searching…</p>
          ) : hasResults ? (
            groupOrder.map((type) => {
              const items = results[type]
              if (items.length === 0) return null

              return (
                <div key={type} className={styles.group}>
                  <h3 className={styles.groupLabel}>{GROUP_LABELS[type]}</h3>
                  {items.map((item) => {
                    runningIndex += 1
                    const isHighlighted = runningIndex === highlightedIndex

                    if (type === 'asks') {
                      return (
                        <Link
                          key={item.id}
                          to={`/app/asks/${item.id}`}
                          role="option"
                          aria-selected={isHighlighted}
                          className={[styles.result, isHighlighted ? styles.highlighted : ''].filter(Boolean).join(' ')}
                          onClick={() => goToAsk(item)}
                        >
                          <div className={styles.resultInfo}>
                            <span className={styles.resultTitle}>{item.title}</span>
                            <span className={styles.resultMeta}>
                              {item.category}
                              {item.budgetMin != null &&
                                ` · ${formatBudgetRange(item.budgetMin, item.budgetMax, item.currency)}`}
                            </span>
                          </div>
                        </Link>
                      )
                    }

                    return (
                      <Link
                        key={item.id}
                        to={`/app/profile/${item.id}`}
                        role="option"
                        aria-selected={isHighlighted}
                        className={[styles.result, isHighlighted ? styles.highlighted : ''].filter(Boolean).join(' ')}
                        onClick={() => goToPerson(item)}
                      >
                        <Avatar src={item.avatarUrl} name={item.name} size="sm" />
                        <div className={styles.resultInfo}>
                          <span className={styles.resultTitle}>{item.name}</span>
                          <span className={styles.resultMeta}>
                            {getProfileHeadline(item)}
                            {item.categories?.[0] && ` · ${item.categories[0]}`}
                            {item.rating != null && ` · ★ ${item.rating.toFixed(1)}`}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )
            })
          ) : (
            <p className={styles.status}>No matches for &quot;{term}&quot;</p>
          )}

          <button type="button" className={styles.viewAll} onClick={goToFullResults}>
            View all results for &quot;{term}&quot;
          </button>
        </div>
      )}
    </div>
  )
}
