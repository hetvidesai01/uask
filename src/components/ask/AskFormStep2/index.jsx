import Input from '../../ui/Input'
import Select from '../../ui/Select'
import styles from './AskFormStep2.module.css'

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
]

const REMOTE_OPTIONS = [
  { value: '', label: 'Choose one' },
  { value: 'true', label: 'Remote' },
  { value: 'false', label: 'On-site' },
]

export default function AskFormStep2({ values, errors, onChange }) {
  return (
    <div className={styles.fields}>
      <div className={styles.budgetRow}>
        <Input
          label="Budget minimum"
          type="number"
          min="0"
          placeholder="$0"
          value={values.budgetMin}
          onChange={(e) => onChange('budgetMin', e.target.value)}
          error={errors.budgetMin}
        />
        <Input
          label="Budget maximum"
          type="number"
          min="0"
          placeholder="$0"
          value={values.budgetMax}
          onChange={(e) => onChange('budgetMax', e.target.value)}
          error={errors.budgetMax}
        />
        <Select
          label="Currency"
          options={CURRENCY_OPTIONS}
          value={values.currency}
          onChange={(e) => onChange('currency', e.target.value)}
        />
      </div>

      <Input
        label="Deadline"
        type="date"
        value={values.deadline}
        onChange={(e) => onChange('deadline', e.target.value)}
        error={errors.deadline}
      />

      <Input
        label="Location"
        placeholder="City, state"
        value={values.location}
        onChange={(e) => onChange('location', e.target.value)}
        error={errors.location}
      />

      <Select
        label="Remote or on-site?"
        options={REMOTE_OPTIONS}
        value={values.isRemote}
        onChange={(e) => onChange('isRemote', e.target.value)}
        error={errors.isRemote}
      />
    </div>
  )
}
