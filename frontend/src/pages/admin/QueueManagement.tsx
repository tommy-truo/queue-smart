import { useState } from 'react'
import ConfirmModal from '../../components/ConfirmModal.tsx'
import StatusBadge from '../../components/StatusBadge.tsx'
import { removeFromQueue, requeue, serveNext, useQueues, type QueueView } from '../../queues.ts'

export default function QueueManagement() {
  const [serviceId, setServiceId] = useState('s1')
  const { services, entries, loading, error, busy, message, actionError, refresh, runAction } = useQueues(serviceId)
  const [removing, setRemoving] = useState<QueueView | null>(null)
  const [requeuing, setRequeuing] = useState<QueueView | null>(null)
  const service = services.find(service => service.id === serviceId)

  function confirmRequeue() {
    if (!requeuing || requeuing.status !== 'serving') return
    const entry = requeuing
    setRequeuing(null)
    void runAction(async () => {
      await requeue(entry.serviceId)
      return `Placed ${entry.userName} back in line.`
    })
  }

  function confirmRemove() {
    if (!removing) return
    const entry = removing
    setRemoving(null)
    void runAction(async () => {
      await removeFromQueue(entry.serviceId, entry.id)
      return `Removed ${entry.userName}.`
    })
  }

  if (loading) return <div className="page"><h1>Queue Management</h1><p role="status">Loading queue…</p></div>
  if (error) return <div className="page"><h1>Queue Management</h1><p role="alert">{error}</p><button type="button" onClick={refresh}>Retry</button></div>

  return (
    <div className="page">
      <h1>Queue Management</h1>
      <label>Service{' '}
        <select value={serviceId} disabled={busy} onChange={event => setServiceId(event.target.value)}>
          {services.map(service => <option key={service.id} value={service.id}>{service.name}{service.open ? '' : ' (closed)'}</option>)}
        </select>
      </label>
      <p>{entries.length} in line{service ? `, about ${service.expectedDuration} min each` : ''}.</p>
      {message ? <p role="status">{message}</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
      {entries.length === 0 ? <p>No one is in this queue.</p> : (
        <>
          <button type="button" className="primary" disabled={busy} onClick={event => {
            if (event.detail > 1) return
            void runAction(async () => {
            const result = await serveNext(serviceId)
            return [result.served ? `Served ${result.served.userName}.` : '', result.nowServing ? `Now serving ${result.nowServing.userName}.` : 'The queue is now empty.'].filter(Boolean).join(' ')
            })
          }}>{busy ? 'Updating…' : 'Serve next'}</button>
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>{entries.map(entry => (
              <tr key={entry.id}>
                <td>{entry.position === 0 ? 'Serving' : entry.position}</td><td>{entry.userName}</td>
                <td><StatusBadge status={entry.status} /></td>
                <td>{new Date(entry.joinedAt).toLocaleTimeString([], { timeStyle: 'short' })}</td>
                <td>
                  <button type="button" disabled title="Reordering is not available yet">Up</button>{' '}
                  <button type="button" disabled title="Reordering is not available yet">Down</button>{' '}
                  {entry.status === 'serving' ? <><button type="button" disabled={busy} onClick={() => setRequeuing(entry)}>Requeue</button>{' '}</> : null}
                  <button type="button" disabled={busy} onClick={() => setRemoving(entry)}>Remove</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </>
      )}
      <ConfirmModal open={requeuing !== null} title="Place back in line?" message={`Place ${requeuing?.userName ?? ''} back in line for ${service?.name ?? 'this queue'}?`}
        confirmLabel="Requeue" onConfirm={confirmRequeue} onCancel={() => setRequeuing(null)} />
      <ConfirmModal open={removing !== null} title="Remove from queue?" message={`Remove ${removing?.userName ?? ''} from ${service?.name ?? 'this queue'}?`}
        confirmLabel="Remove" onConfirm={confirmRemove} onCancel={() => setRemoving(null)} />
    </div>
  )
}
