import type { QueueStatus } from '../types.ts'

const labels: Record<QueueStatus, string> = {
  waiting: 'Waiting',
  'almost-ready': 'Almost ready',
  serving: 'Being served',
  served: 'Served',
}

export default function StatusBadge({ status }: { status: QueueStatus }) {
  return <span className={`badge badge-${status}`}>{labels[status]}</span>
}
