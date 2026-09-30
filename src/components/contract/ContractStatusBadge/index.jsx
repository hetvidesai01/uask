import { motion } from 'framer-motion'
import Badge from '../../ui/Badge'
import { SNAPPY_SPRING } from '../../../utils/motion'

// Covers both a contract's own status and a milestone's status — 'paid'
// and 'completed' both mean "fully done," so they share a badge look.
const STATUS_MAP = {
  active: { variant: 'matched', label: 'Active' },
  completed: { variant: 'accepted', label: 'Completed' },
  upcoming: { variant: 'closed', label: 'Upcoming' },
  in_progress: { variant: 'matched', label: 'In progress' },
  submitted: { variant: 'in_review', label: 'Submitted' },
  approved: { variant: 'open', label: 'Approved' },
  paid: { variant: 'accepted', label: 'Paid' },
}

// Keyed on status so a change (e.g. submitted -> approved) pops the new
// badge in once instead of swapping silently.
export default function ContractStatusBadge({ status }) {
  const entry = STATUS_MAP[status] ?? { variant: 'closed', label: status }
  return (
    <motion.span
      key={status}
      style={{ display: 'inline-flex' }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SNAPPY_SPRING}
    >
      <Badge variant={entry.variant}>{entry.label}</Badge>
    </motion.span>
  )
}
