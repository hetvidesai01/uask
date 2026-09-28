import { useEffect, useRef, useState } from 'react'
import Select from '../../ui/Select'
import Input from '../../ui/Input'
import Button from '../../ui/Button'
import Tag from '../../ui/Tag'
import styles from './AskFilters.module.css'

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'open', label: 'Open' },
  { value: 'matched', label: 'Matched' },
  { value: 'in_review', label: 'In review' },
  { value: 'closed', label: 'Closed' },
  { value: 'accepted', label: 'Accepted' },
]

const REMOTE_OPTIONS = [
  { value: '', label: 'Any location type' },
  { value: 'true', label: 'Remote only' },
  { value: 'false', label: 'On-site only' },
]

const POSTED_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

const FILTER_LABELS = {
  category: (value) => value,
  status: (value) => STATUS_OPTIONS.find((o) => o.value === value)?.label,
  isRemote: (value) => REMOTE_OPTIONS.find((o) => o.value === value)?.label,
  location: (value) => `Near "${value}"`,
  budgetMin: (value) => `Min $${value}`,
  budgetMax: (value) => `Max $${value}`,
  postedWithin: (value) => POSTED_OPTIONS.find((o) => o.value === value)?.label,
}

// A dropdown that opens the same filter fields the old sidebar panel had,
// styled to sit beside the "Sort by" select rather than as a separate,
// always-open block. Underlying filter state/behavior (props in, onFilterChange
// out) is unchanged — this is a presentation-only wrapper.
export default function AskFilters({ categories, filters, onFilterChange, onReset }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const categoryOptions = [
    { value: '', label: 'Any category' },
    ...categories.map((c) => ({ value: c.label, label: c.label })),
  ]

  const activeEntries = Object.entries(filters).filter(([, value]) => value)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Filter
        {activeEntries.length > 0 && <span className={styles.count}>{activeEntries.length}</span>}
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Filter ASKs">
          <div className={styles.header}>
            <h2 className={styles.heading}>Filters</h2>
            {activeEntries.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onReset}>
                Clear all
              </Button>
            )}
          </div>

          <div className={styles.fields}>
            <Select
              label="Category"
              options={categoryOptions}
              value={filters.category || ''}
              onChange={(e) => onFilterChange('category', e.target.value)}
            />

            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={filters.status || ''}
              onChange={(e) => onFilterChange('status', e.target.value)}
            />

            <Select
              label="Location type"
              options={REMOTE_OPTIONS}
              value={filters.isRemote || ''}
              onChange={(e) => onFilterChange('isRemote', e.target.value)}
            />

            <Input
              label="Location"
              placeholder="City, state..."
              value={filters.location || ''}
              onChange={(e) => onFilterChange('location', e.target.value)}
            />

            <div className={styles.budgetRow}>
              <Input
                label="Min budget"
                type="number"
                min="0"
                placeholder="$0"
                value={filters.budgetMin || ''}
                onChange={(e) => onFilterChange('budgetMin', e.target.value)}
              />
              <Input
                label="Max budget"
                type="number"
                min="0"
                placeholder="Any"
                value={filters.budgetMax || ''}
                onChange={(e) => onFilterChange('budgetMax', e.target.value)}
              />
            </div>

            <Select
              label="Date posted"
              options={POSTED_OPTIONS}
              value={filters.postedWithin || ''}
              onChange={(e) => onFilterChange('postedWithin', e.target.value)}
            />
          </div>

          {activeEntries.length > 0 && (
            <div className={styles.chips}>
              {activeEntries.map(([key, value]) => (
                <Tag key={key} onRemove={() => onFilterChange(key, '')}>
                  {FILTER_LABELS[key] ? FILTER_LABELS[key](value) : value}
                </Tag>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
