import Tag from '../../ui/Tag'
import Button from '../../ui/Button'
import { formatCurrency } from '../../../utils/formatCurrency'
import styles from './OfferFormStep3.module.css'

export default function OfferFormStep3({ values, onEdit }) {
  return (
    <div className={styles.summary}>
      <section className={styles.group}>
        <div className={styles.groupHeader}>
          <h3 className={styles.groupTitle}>Your offer</h3>
          <Button variant="ghost" size="sm" onClick={() => onEdit(1)}>
            Edit
          </Button>
        </div>
        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt>Price</dt>
            <dd>{formatCurrency(Number(values.price), values.currency)}</dd>
          </div>
          <div className={styles.row}>
            <dt>Delivery</dt>
            <dd>{values.deliveryDays}-day delivery</dd>
          </div>
          <div className={styles.row}>
            <dt>What&apos;s included</dt>
            <dd>
              <div className={styles.chips}>
                {values.deliverables.map((item) => (
                  <Tag key={item}>{item}</Tag>
                ))}
              </div>
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.group}>
        <div className={styles.groupHeader}>
          <h3 className={styles.groupTitle}>Why you&apos;re a fit</h3>
          <Button variant="ghost" size="sm" onClick={() => onEdit(2)}>
            Edit
          </Button>
        </div>
        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt>Pitch</dt>
            <dd className={styles.multiline}>{values.pitch}</dd>
          </div>
          <div className={styles.row}>
            <dt>Experience</dt>
            <dd className={styles.multiline}>{values.experience || 'None'}</dd>
          </div>
          <div className={styles.row}>
            <dt>Portfolio</dt>
            <dd className={styles.multiline}>{values.portfolioLinks || 'None'}</dd>
          </div>
          <div className={styles.row}>
            <dt>Attachments</dt>
            <dd>
              {values.attachments.length > 0 ? (
                <div className={styles.chips}>
                  {values.attachments.map((file) => (
                    <Tag key={file.name}>{file.name}</Tag>
                  ))}
                </div>
              ) : (
                'None'
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
