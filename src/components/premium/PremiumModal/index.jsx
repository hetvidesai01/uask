import { useState } from 'react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import styles from './PremiumModal.module.css'

const FEATURES = [
  ['Post ASKs', 'Unlimited', 'Unlimited'],
  ['Discover ASKs', 'Unlimited', 'Unlimited'],
  ['Receive Offers', 'Unlimited', 'Unlimited'],
  ['AI ASK Assistant', '3/week', 'Unlimited'],
  ['AI Proposal Assistant', '5/week', 'Unlimited'],
  ['AI Matching', '5/week', 'Unlimited'],
  ['Quick Call / Video', '2/week', 'Unlimited'],
  ['ASK Templates', '3 saved', 'Unlimited'],
  ['Auto Contracts', '2/month', 'Unlimited'],
  ['Shortlisting', '10/week', 'Unlimited'],
  ['Analytics', 'Basic', 'Advanced'],
  ['Profile Boosts', '1/week', 'Unlimited'],
  ['Smart Alerts', 'Standard', 'Advanced'],
  ['Portfolio & Profile', 'Full access', 'Full access'],
  ['Messaging', 'Unlimited', 'Unlimited'],
  ['Compare Professionals', 'Unlimited', 'Unlimited'],
]

export default function PremiumModal({ open, onClose, plan, onUpgrade }) {
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [submitting, setSubmitting] = useState(false)
  const [upgraded, setUpgraded] = useState(false)

  const isPremium = plan === 'premium' || upgraded

  function handleClose() {
    setUpgraded(false)
    onClose?.()
  }

  async function handleUpgrade() {
    setSubmitting(true)
    try {
      await onUpgrade?.(billingCycle)
      setUpgraded(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="UASK Premium" size="lg">
      {isPremium ? (
        <div className={styles.success}>
          <span className={styles.successIcon} aria-hidden="true">
            ✓
          </span>
          <h3 className={styles.successTitle}>You're on UASK Premium</h3>
          <p className={styles.successCopy}>
            Every AI tool, boost and workflow feature is unlocked — no weekly limits.
          </p>
          <Button onClick={handleClose}>Done</Button>
        </div>
      ) : (
        <>
          <p className={styles.intro}>
            Basic covers the core ASK → MATCH → CONNECT flow at no cost. Premium removes every
            weekly limit on AI tools, boosts and workflow features.
          </p>

          <div className={styles.plans}>
            <div className={styles.planCard}>
              <span className={styles.planName}>Basic</span>
              <span className={styles.planPrice}>Free</span>
              <span className={styles.planNote}>Always free</span>
            </div>

            <div className={`${styles.planCard} ${styles.premiumCard}`}>
              <span className={styles.planName}>Premium</span>

              <div className={styles.billingToggle} role="group" aria-label="Billing cycle">
                <button
                  type="button"
                  className={[styles.billingOption, billingCycle === 'monthly' ? styles.billingActive : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={billingCycle === 'monthly'}
                  onClick={() => setBillingCycle('monthly')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={[styles.billingOption, billingCycle === 'yearly' ? styles.billingActive : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={billingCycle === 'yearly'}
                  onClick={() => setBillingCycle('yearly')}
                >
                  Yearly
                </button>
              </div>

              <span className={styles.planPrice}>
                {billingCycle === 'monthly' ? '₹149' : '₹999'}
                <span className={styles.planPriceUnit}>/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
              </span>
              <span className={styles.planNote}>
                {billingCycle === 'monthly' ? 'or ₹999/year, billed annually' : 'Save ~44% vs. monthly billing'}
              </span>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col">Basic</th>
                  <th scope="col" className={styles.premiumCol}>
                    Premium
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map(([feature, basic, premium]) => (
                  <tr key={feature}>
                    <th scope="row">{feature}</th>
                    <td>{basic}</td>
                    <td className={styles.premiumCol}>{premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button fullWidth loading={submitting} onClick={handleUpgrade}>
            Upgrade to Premium
          </Button>
        </>
      )}
    </Modal>
  )
}
