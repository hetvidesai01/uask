import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import Avatar from '../../components/ui/Avatar'
import AskStatusBadge from '../../components/ask/AskStatusBadge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import MessageBubble from '../../components/messages/MessageBubble'
import MessageComposer from '../../components/messages/MessageComposer'
import { useToast } from '../../hooks/useToast'
import { getMessages, markThreadAsRead, sendMessage } from '../../services/messageService'
import styles from './Thread.module.css'

export default function Thread() {
  const { threadId } = useParams()
  const { threads, participantsById, askTitlesById, currentUser, onThreadRead, onMessageSent } =
    useOutletContext()
  const { showToast } = useToast()

  const thread = threads.find((item) => item.id === threadId)
  const hasThread = Boolean(thread)

  const [status, setStatus] = useState('loading')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const markedRef = useRef(new Set())

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const result = await getMessages(threadId)
      setMessages(result)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }, [threadId])

  useEffect(() => {
    if (!hasThread) {
      setStatus('not_found')
      return
    }
    load()
  }, [hasThread, load])

  useEffect(() => {
    if (!thread || thread.unreadCount === 0) return
    if (markedRef.current.has(threadId)) return
    markedRef.current.add(threadId)

    markThreadAsRead(threadId, currentUser.id).then(() => {
      onThreadRead(threadId)
    })
  }, [thread, threadId, currentUser.id, onThreadRead])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function handleSend(body) {
    setSending(true)
    try {
      const newMessage = await sendMessage({ threadId, senderId: currentUser.id, body })
      setMessages((current) => [...current, newMessage])
      onMessageSent(threadId, newMessage.body)
    } catch {
      showToast('Message failed to send. Please try again.', 'error')
    } finally {
      setSending(false)
    }
  }

  if (status === 'not_found') {
    return (
      <div className={styles.centered}>
        <EmptyState
          icon="🚫"
          title="Conversation not found"
          message="This conversation may have been removed, or the link is incorrect."
          action={
            <Button as={Link} to="/app/inbox" variant="secondary">
              Back to inbox
            </Button>
          }
        />
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className={styles.centered}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.centered}>
        <EmptyState
          icon="⚠️"
          title="Couldn't load this conversation"
          message="Something went wrong loading these messages. Please try again."
          action={
            <Button variant="secondary" onClick={load}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  const otherId = thread.participantIds.find((id) => id !== currentUser.id)
  const participant = participantsById[otherId]
  const ask = thread.askId ? askTitlesById[thread.askId] : null

  return (
    <div className={styles.thread}>
      <div className={styles.header}>
        <Link to="/app/inbox" className={styles.back} aria-label="Back to conversations">
          ←
        </Link>

        <Avatar src={participant?.avatarUrl} name={participant?.name ?? '?'} size="md" />

        <div className={styles.headerInfo}>
          <Link to={`/app/profile/${participant?.id}`} className={styles.participantName}>
            {participant?.name ?? 'Unknown user'}
          </Link>
          {ask && (
            <Link to={`/app/asks/${ask.id}`} className={styles.askContext}>
              <span className={styles.askContextTitle}>{ask.title}</span>
              <AskStatusBadge status={ask.status} />
            </Link>
          )}
        </div>
      </div>

      <div className={styles.messages} ref={scrollRef}>
        {messages.map((message, index) => {
          const previous = messages[index - 1]
          const next = messages[index + 1]
          const grouped = Boolean(previous) && previous.senderId === message.senderId
          const showTime = !next || next.senderId !== message.senderId

          return (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === currentUser.id}
              grouped={grouped}
              showTime={showTime}
            />
          )
        })}
      </div>

      <MessageComposer onSend={handleSend} sending={sending} />
    </div>
  )
}
