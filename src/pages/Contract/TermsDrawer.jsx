import Drawer from '../../components/ui/Drawer'
import styles from './ContractParts.module.css'

const SECTIONS = [
  {
    title: '1. Contract Agreement',
    bullets: [
      'The contract is generated from the ASK and accepted response.',
      'Both parties must agree to the scope, price, deliverables, deadlines and payment terms before work begins.',
      'Contract changes require mutual approval through UASK.',
    ],
  },
  {
    title: '2. Payment Terms — 25–50–25',
    bullets: [
      '25%: Initial payment at contract confirmation.',
      '50%: Payable when approximately 60% of the work is completed and approved.',
      '25%: Payable after final completion and approval.',
      'The client-side platform fee and freelancer-side commission are displayed separately.',
    ],
  },
  {
    title: '3. Responsibilities',
    paragraphs: [
      'ASK Side: Provide clear requirements, materials, timely feedback and milestone payments.',
      'Respond Side: Deliver agreed work on time, communicate delays and complete included revisions.',
    ],
  },
  {
    title: '4. Revisions & Disputes',
    bullets: [
      'The contract specifies the number of included revisions.',
      'Scope mismatches may be corrected or raised as disputes.',
      'UASK may review the ASK, accepted response, messages and deliverables to support resolution.',
    ],
  },
  {
    title: '5. Cancellation & Termination',
    bullets: [
      'Either party may request cancellation according to the contract and applicable law.',
      'Payment for completed work is subject to acceptance and dispute resolution.',
      'Unused funds are handled according to the agreed refund process.',
      'Both parties must communicate before abandoning an active contract.',
      'Up to 5% of contract value may apply to unjustified early termination after work begins, subject to actual loss, applicable law and dispute review.',
      'It is not automatic and does not apply simply because a party exercises a valid right to terminate.',
    ],
  },
  {
    title: '6. Contract Editing',
    bullets: [
      'First 2 contract edits are free.',
      'From the third edit, a 2.5% fee per edit applies, capped at 7.5% of contract value.',
      'Contract terms lock after the 60% progress milestone, except mutually approved changes or necessary dispute-related corrections.',
    ],
  },
  {
    title: '7. Ownership & Confidentiality',
    bullets: [
      'Ownership of final deliverables and portfolio-use permissions must be agreed in the contract.',
      'Both parties must protect confidential information and respect agreed usage rights.',
    ],
  },
  {
    title: '8. Platform Conduct',
    bullets: [
      'Both parties must provide accurate information and communicate respectfully.',
      "Payments and contract changes should follow UASK's applicable platform procedures.",
    ],
  },
  {
    title: '9. Demo Disclaimer',
    paragraphs: [
      'This is a prototype demonstration only, not a finalized or legally reviewed contract.',
      'No live escrow, payment protection, refund enforcement or penalty collection is implied.',
      'GST is not displayed in this demo.',
      'Actual fees, payment handling and legal terms must be reviewed before launch.',
    ],
  },
]

export default function TermsDrawer({ open, onClose }) {
  return (
    <Drawer open={open} onClose={onClose} title="Terms & Conditions">
      <div className={styles.terms}>
        <h3 className={styles.termsHeading}>UASK — Contract Terms &amp; Conditions</h3>
        <p className={styles.termsDemo}>Demo Version — For Prototype Use Only</p>

        {SECTIONS.map((section) => (
          <section key={section.title} className={styles.termsSection}>
            <h4 className={styles.termsSectionTitle}>{section.title}</h4>
            {section.paragraphs?.map((text) => (
              <p key={text}>{text}</p>
            ))}
            {section.bullets && (
              <ul>
                {section.bullets.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className={styles.termsSection}>
          <h4 className={styles.termsSectionTitle}>Acceptance</h4>
          <p>
            By selecting I Agree &amp; Sign, both parties confirm that they have read and understood these demo terms
            and the specific contract details.
          </p>
        </section>
      </div>
    </Drawer>
  )
}
