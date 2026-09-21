import Tag from '../../ui/Tag'
import Button from '../../ui/Button'
import { formatBudgetRange } from '../../../utils/formatCurrency'
import { formatAbsoluteDate } from '../../../utils/formatDate'
import styles from './AskFormStep4.module.css'

export default function AskFormStep4({ values, onEdit }) {
  return (
    <div className={styles.summary}>
      <section className={styles.group}>
        <div className={styles.groupHeader}>
          <h3 className={styles.groupTitle}>What you need</h3>
          <Button variant="ghost" size="sm" onClick={() => onEdit(1)}>
            Edit
          </Button>
        </div>
        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt>Title</dt>
            <dd>{values.title}</dd>
          </div>
          <div className={styles.row}>
            <dt>Category</dt>
            <dd>{values.category}</dd>
          </div>
          <div className={styles.row}>
            <dt>Description</dt>
            <dd className={styles.multiline}>{values.description}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.group}>
        <div className={styles.groupHeader}>
          <h3 className={styles.groupTitle}>Details</h3>
          <Button variant="ghost" size="sm" onClick={() => onEdit(2)}>
            Edit
          </Button>
        </div>
        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt>Budget</dt>
            <dd>{formatBudgetRange(Number(values.budgetMin), Number(values.budgetMax), values.currency)}</dd>
          </div>
          <div className={styles.row}>
            <dt>Deadline</dt>
            <dd>{values.deadline ? formatAbsoluteDate(values.deadline) : '—'}</dd>
          </div>
          <div className={styles.row}>
            <dt>Location</dt>
            <dd>{values.location}</dd>
          </div>
          <div className={styles.row}>
            <dt>Work type</dt>
            <dd>{values.isRemote === 'true' ? 'Remote' : 'On-site'}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.group}>
        <div className={styles.groupHeader}>
          <h3 className={styles.groupTitle}>Attachments & notes</h3>
          <Button variant="ghost" size="sm" onClick={() => onEdit(3)}>
            Edit
          </Button>
        </div>
        <dl className={styles.rows}>
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
          <div className={styles.row}>
            <dt>Notes</dt>
            <dd className={styles.multiline}>{values.requirements || 'None'}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
