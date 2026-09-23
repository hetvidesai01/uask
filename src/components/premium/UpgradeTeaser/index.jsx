import { motion } from 'framer-motion'
import Button from '../../ui/Button'
import { useAuth } from '../../../hooks/useAuth'
import { useLocalStorage } from '../../../hooks/useLocalStorage'
import { cardEntrance } from '../../../utils/motion'
import styles from './UpgradeTeaser.module.css'

export default function UpgradeTeaser({ onCompare }) {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useLocalStorage(`uask.upgradeTeaser.dismissed.${user.id}`, false)
  const [collapsed, setCollapsed] = useLocalStorage(`uask.upgradeTeaser.collapsed.${user.id}`, false)

  if (dismissed) return null

  if (collapsed) {
    return (
      <button
        type="button"
        className={styles.collapsedTab}
        onClick={() => setCollapsed(false)}
        aria-label="Expand UASK Premium teaser"
      >
        <span className={styles.collapsedDot} aria-hidden="true" />
        Premium
      </button>
    )
  }

  return (
    <motion.aside
      className={styles.teaser}
      initial="hidden"
      animate="visible"
      variants={cardEntrance}
      aria-label="Upgrade to UASK Premium"
    >
      <div className={styles.controls}>
        <button type="button" className={styles.iconButton} onClick={() => setCollapsed(true)} aria-label="Collapse">
          –
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setDismissed(true)}
          aria-label="Dismiss upgrade teaser"
        >
          ✕
        </button>
      </div>

      <span className={styles.kicker}>UASK Premium</span>
      <h3 className={styles.title}>Unlock more with UASK Premium</h3>
      <p className={styles.copy}>Unlimited AI tools, profile boosts and workflow features.</p>

      <Button size="sm" fullWidth onClick={onCompare}>
        Compare Plans
      </Button>
    </motion.aside>
  )
}
