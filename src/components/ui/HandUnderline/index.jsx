import styles from './HandUnderline.module.css'

// Wraps text with a loose, hand-marked underline stroke — an occasional
// expressive accent, not a default text treatment. Use sparingly, on a
// single word or short phrase that should read as emphasized/annotated.
export default function HandUnderline({ children, className = '' }) {
  return (
    <span className={[styles.wrap, className].filter(Boolean).join(' ')}>
      {children}
      <svg
        className={styles.stroke}
        viewBox="0 0 200 16"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M3 10.5C34 4 66 2.5 97 4c31 1.5 62 3.8 100 1.4-27 5.6-63 7.7-97 6.4C68 10.5 35 9 3 10.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
