import Badge from '../../ui/Badge'

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

export default function ContractStatusBadge({ status }) {
  const entry = STATUS_MAP[status] ?? { variant: 'closed', label: status }
  return <Badge variant={entry.variant}>{entry.label}</Badge>
}
