import styles from './Tabs.module.css'

export default function Tabs({ items = [], active, onChange }) {
  return (
    <div className={styles.tabs} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          type="button"
          aria-selected={item.id === active}
          className={[styles.tab, item.id === active ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => onChange?.(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
