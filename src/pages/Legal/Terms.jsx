import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Button from '../../components/ui/Button'
import SignalMark from '../../components/ui/SignalMark'
import { staggerContainer, staggerItem } from '../../utils/motion'
import styles from './Terms.module.css'

// Content and meaning are unchanged from the previous Terms page — only the
// presentation is new. `callout` pulls a few existing ideas out visually.
const SECTIONS = [
  {
    id: 'account-eligibility',
    nav: 'Account Eligibility',
    heading: 'Account Eligibility',
    body: 'To use UASK, you need to be able to enter into an agreement and give us honest details when you sign up. One account is for one person or organization, and keeping your login safe is up to you.',
  },
  {
    id: 'user-responsibilities',
    nav: 'User Responsibilities',
    heading: 'User Responsibilities',
    body: 'What you post, offer and agree to is your responsibility. Please keep your profile and contact details accurate and up to date.',
  },
  {
    id: 'marketplace-conduct',
    nav: 'Marketplace Conduct',
    heading: 'Marketplace Conduct',
    body: 'Be respectful and honest with everyone you meet here. Harassment, discrimination, spam and trying to mislead people have no place on UASK.',
  },
  {
    id: 'asks-and-responses',
    nav: 'ASKs & Responses',
    heading: 'ASK and response accuracy',
    body: "If you post an ASK, describe what you really need as clearly as you can. If you respond, be upfront about what you can deliver, including scope, timeline and price. Please don't post fake or misleading ASKs or offers.",
  },
  {
    id: 'payments-and-fees',
    nav: 'Payments & Fees',
    heading: 'Payments and platform fees',
    body: 'Payments, milestones and fees you see in this prototype are simulated for demonstration. UASK does not currently offer real escrow, payment processing or payment protection. If we introduce fees later, we will tell you before they apply.',
    callout: {
      label: 'Prototype notice',
      text: 'Payments, milestones and fees in this prototype are simulated. There is no real escrow or payment protection.',
    },
  },
  {
    id: 'contracts',
    nav: 'Contracts',
    heading: 'Contract usage',
    body: "The contract tools in this prototype help you write down the scope, milestones and terms you've agreed on. They are a demo. They are also separate from these general terms, and any contract terms you see inside a contract apply only to that contract.",
  },
  {
    id: 'intellectual-property',
    nav: 'Intellectual Property',
    heading: 'Intellectual property',
    body: 'You keep ownership of what you create and upload. By posting it on UASK, you let us display it so the service can work. Who owns the finished work is decided by the agreement between the person who posted the ASK and the provider.',
    callout: {
      label: 'Your work, your agreement',
      text: 'Who owns the finished work is decided by the agreement between the person who posted the ASK and the provider.',
    },
  },
  {
    id: 'confidentiality',
    nav: 'Confidentiality',
    heading: 'Confidentiality',
    body: "Things people share with you in ASKs, messages and contracts are meant to stay between you. Use them only for the purpose they were shared, and don't pass on someone's private information without their permission.",
  },
  {
    id: 'prohibited-activity',
    nav: 'Prohibited Activity',
    heading: 'Prohibited activity',
    body: "Please don't use UASK for anything illegal, fraudulent or harmful. That includes impersonating others, scraping the site, interfering with the service, posting infringing content, or going around the platform to avoid something you've agreed to.",
    callout: {
      label: 'Keep it on UASK',
      text: "Don't go around the platform to avoid something you've agreed to.",
    },
  },
  {
    id: 'suspension-and-termination',
    nav: 'Suspension & Termination',
    heading: 'Account suspension/termination',
    body: 'We may suspend or close accounts that break these terms or put other people at risk. You can stop using UASK whenever you like and ask us to close your account.',
  },
  {
    id: 'disputes',
    nav: 'Disputes',
    heading: 'Disputes',
    body: "If something goes wrong, we encourage you to talk it through with the other person first. The dispute features in this prototype are only demonstrations. They are not binding arbitration and don't guarantee any outcome.",
  },
  {
    id: 'platform-disclaimer',
    nav: 'Platform Disclaimer',
    heading: 'Platform disclaimers',
    body: 'UASK is a prototype and is provided "as is". We help people find each other, but we can\'t promise the quality, safety or legality of any ASK, offer or user, or how any engagement turns out.',
  },
  {
    id: 'limitation-of-liability',
    nav: 'Limitation of Liability',
    heading: 'Limitation of liability',
    body: "As far as the law allows, UASK isn't responsible for indirect or consequential losses that come from using this prototype or from dealings between users. The final wording on liability will be set in the launch terms.",
  },
  {
    id: 'changes-to-terms',
    nav: 'Changes to Terms',
    heading: 'Changes to terms',
    body: "These terms will change as UASK grows. We'll let you know about important changes, and if you keep using UASK after an update, that means you accept the new version.",
  },
]

const PROTOTYPE_POINTS = [
  'These terms are for demonstration.',
  'They are not finalized legal terms and are not legally enforceable as written.',
  'No real escrow, payment processing or payment protection is offered or implied.',
  'The final launch terms will need a legal review.',
]

const pad = (index) => String(index + 1).padStart(2, '0')

function scrollToId(id) {
  const target = document.getElementById(id)
  if (!target) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

export default function Terms() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Highlights the "On this page" item for the section nearest the top.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        })
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )
    SECTIONS.forEach((section) => {
      const node = document.getElementById(section.id)
      if (node) observer.observe(node)
    })
    return () => observer.disconnect()
  }, [])

  const handleNavClick = (event, id) => {
    event.preventDefault()
    scrollToId(id)
    setActiveId(id)
  }

  return (
    <div className={styles.page}>
      {/* Decorative only: low-opacity, non-interactive. */}
      <div className={styles.ambient} aria-hidden="true">
        <span className={`${styles.blob} ${styles.blobA}`} />
        <span className={`${styles.blob} ${styles.blobB}`} />
        <SignalMark size="lg" rings={3} className={styles.signalA} />
        <SignalMark size="lg" rings={2} className={styles.signalB} />
        <svg className={styles.lines} viewBox="0 0 1200 800" preserveAspectRatio="none">
          <path d="M0 140 C 260 60, 420 240, 700 150 S 1050 40, 1200 120" />
          <path d="M0 520 C 220 600, 480 420, 760 540 S 1060 640, 1200 500" />
          <circle cx="700" cy="150" r="4" />
          <circle cx="260" cy="125" r="3" />
          <circle cx="760" cy="540" r="4" />
          <circle cx="1060" cy="600" r="3" />
        </svg>
      </div>

      <motion.header
        className={styles.hero}
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        transition={{ staggerChildren: 0.1 }}
      >
        <motion.p className={styles.eyebrow} variants={staggerItem}>
          The fine print, made clear
        </motion.p>
        <motion.h1 className={styles.h1} variants={staggerItem}>
          Terms &amp; Conditions
        </motion.h1>
        <motion.p className={styles.lead} variants={staggerItem}>
          The rules that keep UASK clear, fair and useful for everyone.
        </motion.p>
        <motion.div className={styles.meta} variants={staggerItem}>
          <span className={styles.pill}>Demo / Prototype Terms</span>
          <span className={styles.updated}>Last updated: October 2026</span>
        </motion.div>
        <motion.p className={styles.heroNote} variants={staggerItem}>
          Demo / Prototype Terms — Not Final Legal Terms. These terms describe how the UASK prototype is meant to be
          used, in plain language. The final launch terms will need a legal review.
        </motion.p>
      </motion.header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          {/* Mobile / tablet: compact jump control */}
          <div className={styles.jump}>
            <label htmlFor="terms-jump" className={styles.jumpLabel}>
              Jump to section
            </label>
            <select
              id="terms-jump"
              className={styles.jumpSelect}
              value={activeId}
              onChange={(event) => {
                scrollToId(event.target.value)
                setActiveId(event.target.value)
              }}
            >
              {SECTIONS.map((section, index) => (
                <option key={section.id} value={section.id}>
                  {pad(index)} {section.nav}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop: sticky table of contents */}
          <nav className={styles.toc} aria-label="On this page">
            <p className={styles.tocTitle}>On this page</p>
            <ol className={styles.tocList}>
              {SECTIONS.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={[styles.tocLink, activeId === section.id ? styles.tocActive : ''].join(' ')}
                    aria-current={activeId === section.id ? 'location' : undefined}
                    onClick={(event) => handleNavClick(event, section.id)}
                  >
                    <span className={styles.tocNum}>{pad(index)}</span>
                    {section.nav}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <div className={styles.main}>
          {SECTIONS.map((section, index) => (
            <motion.section
              key={section.id}
              id={section.id}
              className={styles.section}
              aria-labelledby={`${section.id}-title`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className={styles.number} aria-hidden="true">
                {pad(index)}
              </span>
              <div className={styles.sectionBody}>
                <span className={styles.rule} aria-hidden="true" />
                <h2 id={`${section.id}-title`} className={styles.h2}>
                  {section.heading}
                </h2>
                <p className={styles.text}>{section.body}</p>
                {section.callout && (
                  <aside className={styles.callout}>
                    <span className={styles.calloutLabel}>{section.callout.label}</span>
                    <p>{section.callout.text}</p>
                  </aside>
                )}
              </div>
            </motion.section>
          ))}

          <motion.section
            className={styles.prototype}
            aria-labelledby="prototype-note-title"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <SignalMark size="md" rings={2} className={styles.prototypeMark} />
            <h2 id="prototype-note-title" className={styles.h2}>
              A note about this prototype
            </h2>
            <ul className={styles.prototypeList}>
              {PROTOTYPE_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </motion.section>

          <motion.section
            className={styles.cta}
            aria-labelledby="terms-cta-title"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 id="terms-cta-title" className={styles.ctaHeading}>
              Questions about the rules?
            </h2>
            <p className={styles.text}>We want UASK to be understandable before you commit to anything.</p>
            <div className={styles.ctaActions}>
              <Button as={Link} to="/about#contact">
                Contact Us
              </Button>
              <Button as={Link} to="/privacy" variant="secondary">
                Privacy Policy
              </Button>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  )
}
