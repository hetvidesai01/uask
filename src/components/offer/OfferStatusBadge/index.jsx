import Badge from '../../ui/Badge'

const STATUS_MAP = {
  pending: { variant: 'in_review', label: 'Pending' },
  shortlisted: { variant: 'matched', label: 'Shortlisted' },
  accepted: { variant: 'accepted', label: 'Accepted' },
  rejected: { variant: 'rejected', label: 'Rejected' },
}

export default function OfferStatusBadge({ status }) {
  const entry = STATUS_MAP[status] || { variant: 'closed', label: status }
  return <Badge variant={entry.variant}>{entry.label}</Badge>
}
