import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import styles from './NotFound.module.css'

export default function NotFound() {
  return (
    <div className={`container ${styles.page}`}>
      <EmptyState
        icon="🧭"
        title="Page not found"
        message="We could not find that page. It may have moved, or the link may be wrong."
        action={
          <Button as={Link} to="/" variant="secondary">
            Back home
          </Button>
        }
      />
    </div>
  )
}
