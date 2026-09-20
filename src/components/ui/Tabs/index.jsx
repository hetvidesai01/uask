import { useRef } from 'react'
import styles from './Tabs.module.css'

export default function Tabs({ items = [], active, onChange }) {
  const tabRefs = useRef([])

  const focusTab = (index) => {
    const wrapped = (index + items.length) % items.length
    tabRefs.current[wrapped]?.focus()
    onChange?.(items[wrapped].id)
  }

  const handleKeyDown = (event, index) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        focusTab(index + 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        focusTab(index - 1)
        break
      case 'Home':
        event.preventDefault()
        focusTab(0)
        break
      case 'End':
        event.preventDefault()
        focusTab(items.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div className={styles.tabs} role="tablist">
      {items.map((item, index) => {
        const isActive = item.id === active
        return (
          <button
            key={item.id}
            ref={(node) => {
              tabRefs.current[index] = node
            }}
            role="tab"
            type="button"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={[styles.tab, isActive ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => onChange?.(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
