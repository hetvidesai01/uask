import { useState } from 'react'
import Drawer from '../../ui/Drawer'
import Button from '../../ui/Button'
import AnimatedBackground from '../../ui/AnimatedBackground'
import uaskLogo from '../../../assets/brand/uask.logo.png'
import styles from './PremiumDrawer.module.css'

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

const PRICE_LABEL = { monthly: '₹149', yearly: '₹999' }
const PRICE_UNIT = { monthly: 'month', yearly: 'year' }

// Steps: 'compare' (plan comparison + billing toggle) -> 'checkout' (mock
// payment-preparation screen) -> 'confirmation' (clear dev/mock state — no
// subscription change happens here; see subscriptionService.createCheckoutSession).
export default function PremiumDrawer({ open, onClose, plan, onCheckout }) {
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [step, setStep] = useState('compare')
  const [submitting, setSubmitting] = useState(false)

  const isPremium = plan === 'premium'

  function reset() {
    setStep('compare')
    setSubmitting(false)
  }

  function handleClose() {
    reset()
    onClose?.()
  }

  function handleStartUpgrade() {
    setStep('checkout')
  }

  async function handleProceedToPayment() {
    setSubmitting(true)
    try {
      await onCheckout?.(billingCycle)
      setStep('confirmation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="UASK Premium"
      headerContent={<img src={uaskLogo} alt="UASK" className={styles.headerLogo} />}
    >
      <div className={styles.content}>
        <AnimatedBackground variant="rich" />
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
        ) : step === 'checkout' ? (
          <div className={styles.checkout}>
            <p className={styles.intro}>Review your plan before continuing to payment.</p>

            <div className={styles.checkoutSummary}>
              <div className={styles.checkoutRow}>
                <span>Plan</span>
                <span>UASK Premium</span>
              </div>
              <div className={styles.checkoutRow}>
                <span>Billing</span>
                <span>{billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}</span>
              </div>
              <div className={styles.checkoutRow}>
                <span>Total due today</span>
                <span className={styles.checkoutTotal}>
                  {PRICE_LABEL[billingCycle]}
                  <span className={styles.planPriceUnit}>/{PRICE_UNIT[billingCycle]}</span>
                </span>
              </div>
            </div>

            <div className={styles.devNotice}>
              <span className={styles.devNoticeIcon} aria-hidden="true">
                🚧
              </span>
              <p>
                Payment processing isn't connected yet — this is a preview of the checkout flow. Proceeding
                simulates hitting a backend checkout endpoint; it won't charge you or change your plan.
              </p>
            </div>

            <div className={styles.checkoutActions}>
              <Button variant="secondary" onClick={() => setStep('compare')} disabled={submitting}>
                Back
              </Button>
              <Button loading={submitting} onClick={handleProceedToPayment}>
                Proceed to Payment
              </Button>
            </div>
          </div>
        ) : step === 'confirmation' ? (
          <div className={styles.confirmation}>
            <span className={styles.confirmationIcon} aria-hidden="true">
              🚧
            </span>
            <h3 className={styles.successTitle}>Payment integration coming soon</h3>
            <p className={styles.successCopy}>
              This is a development preview — no payment gateway is connected yet, so no charge was made and your
              plan is still Basic. When checkout goes live, this step will hand off to a real payment provider.
            </p>
            <Button onClick={handleClose}>Close</Button>
          </div>
        ) : (
          <>
            <p className={styles.intro}>
              Basic covers the core ASK → MATCH → CONNECT flow at no cost. Premium removes every
              weekly limit on AI tools, boosts and workflow features.
            </p>

            <div className={styles.plans}>
              <div
                className={[styles.planCard, styles.planCardBasic].join(' ')}
                role="button"
                tabIndex={0}
                onClick={handleClose}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleClose()
                  }
                }}
                aria-label="Continue with the Basic plan and close this dialog"
              >
                <span className={styles.planName}>Basic</span>
                <span className={styles.planPrice}>Free</span>
                <span className={styles.planNote}>Always free — tap to stay on Basic</span>
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
                  {PRICE_LABEL[billingCycle]}
                  <span className={styles.planPriceUnit}>/{PRICE_UNIT[billingCycle]}</span>
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

            <Button fullWidth onClick={handleStartUpgrade}>
              Upgrade to Premium
            </Button>
          </>
        )}
      </div>
    </Drawer>
  )
}
