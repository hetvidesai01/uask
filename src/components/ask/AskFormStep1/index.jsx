import Input from '../../ui/Input'
import Select from '../../ui/Select'
import Textarea from '../../ui/Textarea'
import styles from './AskFormStep1.module.css'

export default function AskFormStep1({ values, errors, categories, onChange }) {
  const categoryOptions = [
    { value: '', label: 'Choose a category' },
    ...categories.map((c) => ({ value: c.label, label: c.label })),
  ]

  return (
    <div className={styles.fields}>
      <Input
        label="Title"
        placeholder="e.g. Logo for a new bakery"
        value={values.title}
        onChange={(e) => onChange('title', e.target.value)}
        error={errors.title}
      />

      <Select
        label="Category"
        options={categoryOptions}
        value={values.category}
        onChange={(e) => onChange('category', e.target.value)}
        error={errors.category}
      />

      <Textarea
        label="Description"
        placeholder="What do you need done? The more detail, the better the responses."
        rows={6}
        maxLength={1000}
        value={values.description}
        onChange={(e) => onChange('description', e.target.value)}
        error={errors.description}
      />
    </div>
  )
}
