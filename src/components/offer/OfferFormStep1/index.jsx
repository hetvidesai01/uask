import { useState } from 'react'
import Input from '../../ui/Input'
import Select from '../../ui/Select'
import Button from '../../ui/Button'
import Tag from '../../ui/Tag'
import { CURRENCY_OPTIONS, formatSampleAmount } from '../../../utils/formatCurrency'
import { RevealGroup } from '../../ui/Reveal'
import styles from './OfferFormStep1.module.css'

export default function OfferFormStep1({ values, errors, onChange }) {
  const [itemText, setItemText] = useState('')

  function addDeliverable() {
    const text = itemText.trim()
    if (!text || values.deliverables.includes(text)) return
    onChange('deliverables', [...values.deliverables, text])
    setItemText('')
  }

  function removeDeliverable(item) {
    onChange(
      'deliverables',
      values.deliverables.filter((entry) => entry !== item)
    )
  }

  function handleItemKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addDeliverable()
    }
  }

  return (
    <RevealGroup each calm className={styles.fields}>
      <div className={styles.priceGroup}>
        <span className={styles.groupLabel}>What you&apos;re proposing</span>
        <div className={styles.priceRow}>
          <Input
            label="Price"
            type="number"
            min="0"
            placeholder={formatSampleAmount(15000, values.currency)}
            value={values.price}
            onChange={(e) => onChange('price', e.target.value)}
            error={errors.price}
            className={styles.priceField}
          />
          <Select
            label="Currency"
            options={CURRENCY_OPTIONS}
            value={values.currency}
            onChange={(e) => onChange('currency', e.target.value)}
          />
          <Input
            label="Delivery (days)"
            type="number"
            min="1"
            placeholder="e.g. 5"
            value={values.deliveryDays}
            onChange={(e) => onChange('deliveryDays', e.target.value)}
            error={errors.deliveryDays}
            className={styles.deliveryField}
          />
        </div>
      </div>

      <div className={styles.deliverablesField}>
        <label htmlFor="offer-deliverable" className={styles.label}>
          What&apos;s included
        </label>
        <p className={styles.hint}>Add each thing you&apos;ll deliver, one at a time.</p>
        <div className={styles.addRow}>
          <Input
            id="offer-deliverable"
            placeholder="e.g. 3 logo concepts"
            value={itemText}
            onChange={(e) => setItemText(e.target.value)}
            onKeyDown={handleItemKeyDown}
          />
          <Button type="button" variant="secondary" onClick={addDeliverable}>
            Add
          </Button>
        </div>
        {errors.deliverables && <span className={styles.error}>{errors.deliverables}</span>}
        {values.deliverables.length > 0 && (
          <div className={styles.chips}>
            {values.deliverables.map((item) => (
              <Tag key={item} onRemove={() => removeDeliverable(item)}>
                {item}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </RevealGroup>
  )
}
