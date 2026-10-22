import { useState } from 'react'
import ConfirmModal from '../../components/ConfirmModal.tsx'
import StatusBadge from '../../components/StatusBadge.tsx'
import { removeFromQueue, reorderQueueEntry, serveNext, useQueues, type QueueView } from '../../queues.ts'

type PendingReorder = { entry: QueueView; direction: 'up' | 'down' }

export default function QueueManagement() {
  const [serviceId, setServiceId] = useState('s1')
  const { services, entries, loading, error, busy, message, actionError, refresh, runAction } = useQueues(serviceId)
  const [removing, setRemoving] = useState<QueueView | null>(null)
  const [reordering, setReordering] = useState<PendingReorder | null>(null)
  const service = services.find(service => service.id === serviceId)
  const servingIndex = entries.findIndex(entry => entry.status === 'serving')
  const firstWaitingIndex = servingIndex >= 0 ? servingIndex + 1 : 0
  const lastIndex = entries.length - 1

  function confirmRemove() {
    if (!removing) return
    const entry = removing
    setRemoving(null)
    void runAction(async () => {
      await removeFromQueue(entry.serviceId, entry.id)
      return `Removed ${entry.userName}.`
    })
  }

  function confirmReorder() {
    if (!reordering) return
    const { entry, direction } = reordering
    setReordering(null)
    void runAction(async () => {
      await reorderQueueEntry(entry.serviceId, entry.id, direction)
      return `Moved ${entry.userName} ${direction === 'up' ? 'up' : 'down'}.`
    })
  }

  function reorderDisabled(index: number, direction: 'up' | 'down'): string | undefined {
    const entry = entries[index]
    if (entry.status === 'serving') return 'The person being served cannot be reordered.'
    if (direction === 'up' && index <= firstWaitingIndex) return 'Already at the front of the waiting line.'
    if (direction === 'down' && index >= lastIndex) return 'Already at the back of the line.'
    return undefined
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
            <tbody>{entries.map((entry, index) => (
              <tr key={entry.id}>
                <td>{entry.position === 0 ? 'Serving' : entry.position}</td><td>{entry.userName}</td>
                <td><StatusBadge status={entry.status} /></td>
                <td>{new Date(entry.joinedAt).toLocaleTimeString([], { timeStyle: 'short' })}</td>
                <td>
                  {(['up', 'down'] as const).map(direction => {
                    const disabledReason = reorderDisabled(index, direction)
                    return (
                      <button
                        key={direction}
                        type="button"
                        disabled={busy || disabledReason !== undefined}
                        title={disabledReason}
                        onClick={() => setReordering({ entry, direction })}
                      >
                        {direction === 'up' ? 'Up' : 'Down'}
                      </button>
                    )
                  })}{' '}
                  <button type="button" disabled={busy} onClick={() => setRemoving(entry)}>Remove</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </>
      )}
      <ConfirmModal open={removing !== null} title="Remove from queue?" message={`Remove ${removing?.userName ?? ''} from ${service?.name ?? 'this queue'}?`}
        confirmLabel="Remove" onConfirm={confirmRemove} onCancel={() => setRemoving(null)} />
      <ConfirmModal
        open={reordering !== null}
        title="Move in queue?"
        message={`Move ${reordering?.entry.userName ?? ''} ${reordering?.direction === 'up' ? 'up' : 'down'} in ${service?.name ?? 'this queue'}?`}
        confirmLabel={reordering?.direction === 'up' ? 'Move up' : 'Move down'}
        onConfirm={confirmReorder}
        onCancel={() => setReordering(null)}
      />
    </div>
  )
}
