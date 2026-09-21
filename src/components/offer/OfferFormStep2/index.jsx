import Textarea from '../../ui/Textarea'
import Tag from '../../ui/Tag'
import styles from './OfferFormStep2.module.css'

export default function OfferFormStep2({ values, errors, onChange }) {
  function handleFiles(event) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const existingNames = new Set(values.attachments.map((file) => file.name))
    const newAttachments = files
      .filter((file) => !existingNames.has(file.name))
      .map((file) => ({ name: file.name }))

    onChange('attachments', [...values.attachments, ...newAttachments])
    event.target.value = ''
  }

  function removeAttachment(name) {
    onChange(
      'attachments',
      values.attachments.filter((file) => file.name !== name)
    )
  }

  return (
    <div className={styles.fields}>
      <Textarea
        label="Your pitch"
        placeholder="Why should the seeker pick you? What's your approach?"
        rows={5}
        maxLength={800}
        value={values.pitch}
        onChange={(e) => onChange('pitch', e.target.value)}
        error={errors.pitch}
      />

      <Textarea
        label="Relevant experience (optional)"
        placeholder="Past work that's similar to this ASK"
        rows={3}
        maxLength={400}
        value={values.experience}
        onChange={(e) => onChange('experience', e.target.value)}
      />

      <Textarea
        label="Portfolio links (optional)"
        placeholder="One link per line"
        rows={3}
        maxLength={400}
        value={values.portfolioLinks}
        onChange={(e) => onChange('portfolioLinks', e.target.value)}
      />

      <div className={styles.uploadField}>
        <label htmlFor="offer-attachments" className={styles.label}>
          Attachments (optional)
        </label>
        <p className={styles.hint}>Add samples or files that support your response.</p>
        <input
          id="offer-attachments"
          type="file"
          multiple
          className={styles.fileInput}
          onChange={handleFiles}
        />

        {values.attachments.length > 0 && (
          <div className={styles.chips}>
            {values.attachments.map((file) => (
              <Tag key={file.name} onRemove={() => removeAttachment(file.name)}>
                {file.name}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
