import { useState } from 'react'
import styles from './FaqSection.module.css'

const FAQS = [
  {
    question: 'What is UASK?',
    answer:
      "UASK is a reverse marketplace: instead of browsing endless listings, you post what you need — an ASK — and relevant providers come to you with offers.",
  },
  {
    question: 'How is UASK different from a normal marketplace?',
    answer:
      'Traditional marketplaces make you search and compare listings yourself. On UASK you post one ASK and the matching happens for you — providers respond directly with tailored offers.',
  },
  {
    question: 'Is posting an ASK free?',
    answer:
      'Yes. Posting an ASK, browsing offers and messaging are all free on the Basic plan. Premium adds unlimited AI tools, profile boosts and higher usage limits on top of that.',
  },
  {
    question: 'How do providers respond?',
    answer:
      'Providers discover or get matched to relevant ASKs and submit an offer with their price, timeline and a short proposal. You can compare every offer side by side before choosing.',
  },
  {
    question: 'How does UASK AI work?',
    answer:
      "UASK's AI tools help you write clearer ASKs, get matched to relevant offers faster and draft stronger proposals. They're assistive only — you always review and control what gets posted.",
  },
  {
    question: 'What is Profile Booster?',
    answer:
      'Profile Booster is a visibility score that grows as you complete milestones and collect ratings — a stronger booster helps your profile stand out to the other side of the marketplace.',
  },
  {
    question: 'How do contracts and milestones work?',
    answer:
      'Once you accept an offer, UASK creates a contract with agreed milestones. Each milestone is marked complete and paid as work progresses, so both sides always know what happens next.',
  },
  {
    question: 'What is included in Premium?',
    answer:
      'Premium removes the weekly limits on AI tools, proposal assistance, matching, boosts and more. Open Compare Plans from the app to see the full Basic vs. Premium breakdown.',
  },
  {
    question: 'Can I use UASK as both a client and provider?',
    answer:
      "Yes. Your account can hold both roles at once — post ASKs when you need something done, and respond to other people's ASKs when you have time to offer.",
  },
]

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0)

  function toggle(index) {
    setOpenIndex((current) => (current === index ? -1 : index))
  }

  return (
    <section id="faqs" className="section">
      <div className="container">
        <span className={styles.kicker}>FAQs</span>
        <h2 className={styles.heading}>Frequently asked questions</h2>

        <div className={styles.list}>
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index
            const panelId = `faq-panel-${index}`
            const buttonId = `faq-button-${index}`

            return (
              <div key={faq.question} className={styles.item}>
                <h3 className={styles.itemHeading}>
                  <button
                    type="button"
                    id={buttonId}
                    className={styles.trigger}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(index)}
                  >
                    <span>{faq.question}</span>
                    <span className={[styles.chevron, isOpen ? styles.chevronOpen : ''].filter(Boolean).join(' ')} aria-hidden="true">
                      ▾
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={styles.panel}
                  hidden={!isOpen}
                >
                  <p className={styles.answer}>{faq.answer}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
