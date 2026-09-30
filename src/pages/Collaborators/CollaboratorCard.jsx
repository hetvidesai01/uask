import { motion } from 'framer-motion'
import Avatar from '../../components/ui/Avatar'
import { revealItem, SOFT_SPRING } from '../../utils/motion'
import styles from './Collaborators.module.css'

// Reusable collaborator card. `href` is optional — without it no link is
// rendered. Meant to sit inside a <RevealGroup> so cards stagger in.
export default function CollaboratorCard({ name, type, description, href }) {
  return (
    <motion.article className={styles.card} variants={revealItem} whileHover={{ y: -3 }} transition={SOFT_SPRING}>
      <Avatar name={name} size="lg" />
      <span className={styles.type}>{type}</span>
      <h2 className={styles.name}>{name}</h2>
      <p className={styles.description}>{description}</p>
      {href && (
        <a href={href} className={styles.link} target="_blank" rel="noopener noreferrer">
          Visit website →
        </a>
      )}
    </motion.article>
  )
}
