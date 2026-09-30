import { motion } from 'framer-motion'
import { revealGroup, revealItem } from '../../../utils/motion'
import ThreadListItem from '../ThreadListItem'
import styles from './ThreadList.module.css'

export default function ThreadList({ threads, participantsById, askTitlesById, currentUserId, activeThreadId }) {
  return (
    <motion.ul className={styles.list} initial="hidden" animate="visible" variants={revealGroup}>
      {threads.map((thread) => {
        const otherId = thread.participantIds.find((id) => id !== currentUserId)
        return (
          <motion.li key={thread.id} variants={revealItem}>
            <ThreadListItem
              thread={thread}
              participant={participantsById[otherId]}
              ask={thread.askId ? askTitlesById[thread.askId] : null}
              isActive={thread.id === activeThreadId}
            />
          </motion.li>
        )
      })}
    </motion.ul>
  )
}
