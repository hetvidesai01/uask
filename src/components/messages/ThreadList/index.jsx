import ThreadListItem from '../ThreadListItem'
import styles from './ThreadList.module.css'

export default function ThreadList({ threads, participantsById, askTitlesById, currentUserId, activeThreadId }) {
  return (
    <ul className={styles.list}>
      {threads.map((thread) => {
        const otherId = thread.participantIds.find((id) => id !== currentUserId)
        return (
          <li key={thread.id}>
            <ThreadListItem
              thread={thread}
              participant={participantsById[otherId]}
              ask={thread.askId ? askTitlesById[thread.askId] : null}
              isActive={thread.id === activeThreadId}
            />
          </li>
        )
      })}
    </ul>
  )
}
