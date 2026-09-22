import { useEffect, useId, useRef, useState } from 'react'
import Button from '../../ui/Button'
import styles from './MessageComposer.module.css'

export default function MessageComposer({ onSend, sending }) {
  const [value, setValue] = useState('')
  const fieldId = useId()
  const textareaRef = useRef(null)

  useEffect(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 120)}px`
  }, [value])

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || sending) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit(event)
    }
  }

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <label htmlFor={fieldId} className="sr-only">
        Write a message
      </label>
      <textarea
        id={fieldId}
        ref={textareaRef}
        className={styles.input}
        placeholder="Write a message..."
        rows={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={sending}
      />
      <Button type="submit" size="sm" disabled={!value.trim() || sending} loading={sending}>
        Send
      </Button>
    </form>
  )
}
