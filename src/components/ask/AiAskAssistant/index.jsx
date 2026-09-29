import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Button from '../../ui/Button'
import Textarea from '../../ui/Textarea'
import AnimatedCounter from '../../ui/AnimatedCounter'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { getSuggestions, getAskStrength } from '../../../services/aiAssistantService'
import { formatBudgetRange } from '../../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../../utils/formatDate'
import { staggerContainer, staggerItem } from '../../../utils/motion'
import styles from './AiAskAssistant.module.css'

const EDITABLE_FIELDS = new Set(['title', 'description'])

function strengthTone(score) {
  if (score >= 75) return { className: 'strong', label: 'Strong ASK' }
  if (score >= 40) return { className: 'good', label: 'Good start' }
  return { className: 'weak', label: 'Needs more detail' }
}

function SuggestionValue({ suggestion }) {
  if (suggestion.field === 'budgetTimeline') {
    const { budgetMin, budgetMax, deadline } = suggestion.value
    return (
      <p className={styles.suggestionValue}>
        {formatBudgetRange(Number(budgetMin), Number(budgetMax), 'USD')} · by {formatAbsoluteDate(deadline)}
      </p>
    )
  }
  return <p className={styles.suggestionValue}>{suggestion.value}</p>
}

// A soft, visually separate "studio" panel — deliberately not styled like
// the surrounding form fields. Frontend/mock only (see
// services/aiAssistantService.js): no real model call, no auto-overwriting
// of anything the user typed. Accept/Edit/Dismiss are the only ways a
// suggestion ever reaches the actual draft.
export default function AiAskAssistant({ values, onAccept }) {
  const signature = JSON.stringify({
    title: values.title,
    description: values.description,
    category: values.category,
    budgetMin: values.budgetMin,
    budgetMax: values.budgetMax,
    deadline: values.deadline,
    location: values.location,
    isRemote: values.isRemote,
  })
  const debouncedSignature = useDebouncedValue(signature, 500)

  const [suggestions, setSuggestions] = useState([])
  const [dismissedIds, setDismissedIds] = useState(() => new Set())
  const [strength, setStrength] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([getSuggestions(values), getAskStrength(values)]).then(([nextSuggestions, nextStrength]) => {
      if (cancelled) return
      setSuggestions(nextSuggestions)
      setStrength(nextStrength)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
    // Re-run only when the debounced snapshot of relevant fields changes —
    // `values` itself changes on every keystroke, which would defeat the
    // debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSignature])

  const visibleSuggestions = suggestions.filter((suggestion) => !dismissedIds.has(suggestion.id))
  const tone = strengthTone(strength)

  function dismiss(id) {
    setDismissedIds((current) => new Set(current).add(id))
    if (editingId === id) setEditingId(null)
  }

  function accept(suggestion, overrideValue) {
    onAccept(suggestion.field, overrideValue !== undefined ? overrideValue : suggestion.value)
    setSuggestions((current) => current.filter((item) => item.id !== suggestion.id))
    setEditingId(null)
  }

  function startEdit(suggestion) {
    setEditingId(suggestion.id)
    setEditValue(suggestion.value)
  }

  return (
    <section className={styles.panel} aria-label="AI Ask Assistant">
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.sparkle} aria-hidden="true">
            ✨
          </span>
          <h2 className={styles.title}>AI Ask Assistant</h2>
        </div>
        <p className={styles.subtitle}>
          Mock suggestions to help strengthen your ASK — nothing here changes your draft until you accept it.
        </p>
      </div>

      <div className={styles.strengthRow}>
        <div className={styles.strengthLabel}>
          <span className={styles.strengthTitle}>ASK Strength</span>
          <span className={[styles.strengthTone, styles[tone.className]].join(' ')}>{tone.label}</span>
        </div>
        <div className={styles.strengthBarTrack}>
          <motion.div
            className={[styles.strengthBarFill, styles[tone.className]].join(' ')}
            animate={{ width: `${strength}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <span className={styles.strengthScore}>
          <AnimatedCounter value={strength} suffix="%" duration={0.6} />
        </span>
      </div>

      <div className={styles.suggestions}>
        {loading ? (
          <p className={styles.status}>Analyzing your draft…</p>
        ) : visibleSuggestions.length === 0 ? (
          <p className={styles.status}>No suggestions right now — your ASK covers the essentials.</p>
        ) : (
          <motion.ul
            className={styles.list}
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <AnimatePresence initial={false}>
              {visibleSuggestions.map((suggestion) => (
                <motion.li
                  key={suggestion.id}
                  className={styles.suggestion}
                  variants={staggerItem}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  layout
                >
                  <div className={styles.suggestionBody}>
                    <p className={styles.suggestionLabel}>{suggestion.label}</p>
                    <p className={styles.suggestionDescription}>{suggestion.description}</p>

                    {editingId === suggestion.id ? (
                      <Textarea
                        aria-label={suggestion.label}
                        rows={suggestion.field === 'description' ? 4 : 2}
                        value={editValue}
                        onChange={(event) => setEditValue(event.target.value)}
                        className={styles.editField}
                      />
                    ) : (
                      <SuggestionValue suggestion={suggestion} />
                    )}
                  </div>

                  <div className={styles.suggestionActions}>
                    {editingId === suggestion.id ? (
                      <>
                        <Button size="sm" onClick={() => accept(suggestion, editValue)}>
                          Use this
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => accept(suggestion)}>
                          Accept
                        </Button>
                        {EDITABLE_FIELDS.has(suggestion.field) && (
                          <Button size="sm" variant="secondary" onClick={() => startEdit(suggestion)}>
                            Edit
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => dismiss(suggestion.id)}>
                          Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </section>
  )
}
