import { useState } from 'react'
import { Link } from 'react-router'
import { leaveQueue, useQueues } from '../../queues.ts'
import type { QueueView } from '../../queues.ts'
import StatusBadge from '../../components/StatusBadge.tsx'
import ConfirmModal from '../../components/ConfirmModal.tsx'

export default function QueueStatus() {
  const { services, entries, loading, error, busy, message, actionError, refresh, runAction } = useQueues()
  const [leaving, setLeaving] = useState<QueueView | null>(null)
  const serviceName = (id: string) => services.find(service => service.id === id)?.name ?? 'Service'
  // Position excludes the serving chair; the estimate counts everyone ahead.
  const peopleAhead = (entry: QueueView) => {
    const duration = services.find(service => service.id === entry.serviceId)?.expectedDuration
    return duration ? Math.max(0, Math.round(entry.estimatedWait / duration)) : 0
  }

  function confirmLeave() {
    if (!leaving) return
    const entry = leaving
    const name = serviceName(entry.serviceId)
    setLeaving(null)
    void runAction(async () => {
      await leaveQueue(entry.serviceId)
      return `You left ${name}.`
    })
  }

  if (loading) return <div className="page"><h1>Queue Status</h1><p role="status">Loading queues…</p></div>
  if (error) return <div className="page"><h1>Queue Status</h1><p role="alert">{error}</p><button type="button" onClick={refresh}>Retry</button></div>

  return (
    <div className="page">
      <h1>Queue Status</h1>
      {message ? <p role="status">{message}</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
      {entries.length === 0 ? <p>You are not currently in a queue. <Link to="/join">Join a Queue</Link></p> : (
        <table>
          <thead><tr><th>Service</th><th>Estimated Wait Time</th><th>Position</th><th>People Ahead</th><th>Status</th><th /></tr></thead>
          <tbody>{entries.map(entry => (
            <tr key={entry.id}>
              <td>{serviceName(entry.serviceId)}</td>
              <td>{entry.estimatedWait} min</td>
              <td>{entry.position === 0 ? 'Being served' : entry.position}</td>
              <td>{peopleAhead(entry)}</td>
              <td><StatusBadge status={entry.status} /></td>
              <td><button type="button" disabled={busy} onClick={() => setLeaving(entry)}>Leave</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <ConfirmModal open={leaving !== null} title="Leave queue?" message={`Leave the queue for ${leaving ? serviceName(leaving.serviceId) : ''}?`}
        confirmLabel="Leave" onConfirm={confirmLeave} onCancel={() => setLeaving(null)} />
    </div>
  )
}
