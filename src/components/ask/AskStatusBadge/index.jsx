import Badge from '../../ui/Badge'

const LABELS = {
  open: 'Open',
  matched: 'Matched',
  in_review: 'In review',
  closed: 'Closed',
  accepted: 'Accepted',
}

export default function AskStatusBadge({ status }) {
  return <Badge variant={status}>{LABELS[status] || status}</Badge>
}
