import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../ui/Button'
import { useToast } from '../../../hooks/useToast'
import { getOrCreateThread } from '../../../services/messageService'

// Opens the Inbox conversation with another user, reusing an existing
// thread when there is one (see messageService.getOrCreateThread).
export default function MessageUserButton({
  currentUserId,
  targetUserId,
  variant = 'primary',
  size = 'sm',
  children = 'Message',
  fullWidth = false,
}) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    setBusy(true)
    try {
      const thread = await getOrCreateThread(currentUserId, targetUserId)
      navigate(`/app/inbox/messages/${thread.id}`)
    } catch {
      showToast('Could not open the conversation. Please try again.', 'error')
      setBusy(false)
    }
  }

  return (
    <Button variant={variant} size={size} fullWidth={fullWidth} loading={busy} onClick={handleClick}>
      {children}
    </Button>
  )
}
