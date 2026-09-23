import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import HowItWorksSection from './HowItWorksSection'
import FaqSection from './FaqSection'
import GuideSection from './GuideSection'
import ProductTourCallout from './ProductTourCallout'
import styles from './Help.module.css'

const QUICK_LINKS = [
  { href: '#how-it-works', label: 'How UASK works' },
  { href: '#faqs', label: 'FAQs' },
  { href: '#for-ask-creators', label: 'For ASK creators' },
  { href: '#for-providers', label: 'For providers' },
]

const ASKER_STEPS = [
  { title: 'Create an ASK', body: 'Describe what you need, your budget and your timeline. It takes a couple of minutes.' },
  {
    title: 'Use the AI Ask Assistant',
    body: 'Let the AI Ask Assistant tighten your wording and suggest details providers usually ask for.',
  },
  { title: 'Receive responses', body: 'Relevant providers see your ASK and start sending offers with their price and approach.' },
  { title: 'Compare providers', body: 'Line every offer up side by side — price, timeline, ratings — before deciding.' },
  { title: 'Accept an offer', body: 'Pick the offer that fits best and accept it to move forward.' },
  {
    title: 'Contract creation',
    body: 'UASK generates a contract from the accepted offer, so the scope and terms are clear for both sides.',
  },
  {
    title: 'Milestones & payment',
    body: 'Work is broken into milestones. Approve each one as it’s completed to release payment.',
  },
  { title: 'Rate the provider', body: 'Once the work is done, leave a rating and review to help the next person choose well.' },
]

const PROVIDER_STEPS = [
  {
    title: 'Discover relevant ASKs',
    body: 'Find ASKs in your categories on the Discover page, or get matched automatically — filter by budget, location and deadline.',
  },
  {
    title: 'Respond with an offer',
    body: 'Send a clear offer with your price, timeline and a short proposal explaining your approach.',
  },
  {
    title: 'Get shortlisted or accepted',
    body: 'The requester compares offers and either shortlists you for a conversation or accepts you outright.',
  },
  {
    title: 'Contract & milestone workflow',
    body: "Once accepted, you'll see the contract and its milestones — the agreed roadmap for the work.",
  },
  { title: 'Submit your work', body: 'Deliver against each milestone and mark it ready for review.' },
  { title: 'Receive payment', body: 'Approved milestones release payment — no separate invoicing needed.' },
  {
    title: 'Receive ratings',
    body: 'After the contract closes, the requester rates your work — ratings build your public track record.',
  },
  {
    title: 'Grow your Profile Booster',
    body: 'Every completed milestone and rating feeds your Profile Booster, increasing how often you get matched to new ASKs.',
  },
]

export default function Help() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  return (
    <div>
      <section className={`section ${styles.hero}`}>
        <div className="container">
          <span className={styles.kicker}>Help center</span>
          <h1 className={styles.heading}>Everything you need to use UASK well</h1>
          <p className={styles.subtitle}>
            One guide for both sides of the marketplace — how the flow works, answers to common questions, and a
            step-by-step walkthrough whichever side of an ASK you're on.
          </p>

          <nav className={styles.quickNav} aria-label="Help sections">
            {QUICK_LINKS.map((link) => (
              <a key={link.href} href={link.href} className={styles.quickLink}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <HowItWorksSection />

      <GuideSection
        id="for-ask-creators"
        kicker="For ASK creators"
        heading="Guide for people posting an ASK"
        intro="From posting your first ASK to rating the provider once the work is done."
        steps={ASKER_STEPS}
      />

      <GuideSection
        id="for-providers"
        kicker="For providers"
        heading="Guide for providers"
        intro="From finding ASKs worth responding to, through to getting paid and rated."
        steps={PROVIDER_STEPS}
        tone="provider"
      />

      <FaqSection />

      <ProductTourCallout />
    </div>
  )
}
