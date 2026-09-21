import Textarea from '../../ui/Textarea'
import Tag from '../../ui/Tag'
import styles from './AskFormStep3.module.css'

export default function AskFormStep3({ values, onChange }) {
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
      <div className={styles.uploadField}>
        <label htmlFor="ask-attachments" className={styles.label}>
          Attachments (optional)
        </label>
        <p className={styles.hint}>
          Add reference files, photos, or documents that help explain your ASK.
        </p>
        <input
          id="ask-attachments"
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

      <Textarea
        label="Requirements or extra notes (optional)"
        placeholder="Anything else providers should know — must-haves, preferences, constraints..."
        rows={5}
        maxLength={500}
        value={values.requirements}
        onChange={(e) => onChange('requirements', e.target.value)}
      />
    </div>
  )
}
