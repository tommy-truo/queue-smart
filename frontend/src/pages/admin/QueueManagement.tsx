import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Priority } from '../../types.ts'
import ConfirmModal from '../../components/ConfirmModal.tsx'
import { formatTime } from '../../format.ts'
import StatusBadge from '../../components/StatusBadge.tsx'
import { removeFromQueue, reorderQueueEntry, requeue, serveNext, setQueuePriority, useQueues, type QueueView } from '../../queues.ts'

type PendingReorder = { entry: QueueView; direction: 'up' | 'down' }

export default function QueueManagement() {
  const [params, setParams] = useSearchParams()
  const requestedServiceId = params.get('serviceId') ?? ''
  const { services, entries, loading, error, busy, message, actionError, refresh, runAction, selectedServiceId: serviceId } = useQueues(requestedServiceId)
  const [removing, setRemoving] = useState<QueueView | null>(null)
  const [requeuing, setRequeuing] = useState<QueueView | null>(null)
  const [reordering, setReordering] = useState<PendingReorder | null>(null)
  const service = services.find(service => service.id === serviceId)

  function confirmRequeue() {
    if (!requeuing || requeuing.status !== 'serving') return
    const entry = requeuing
    setRequeuing(null)
    void runAction(async () => {
      if (entries.find(item => item.status === 'serving')?.id !== entry.id) throw new Error('The person being served changed. Review the queue and try again.')
      await requeue(entry.serviceId)
      return `Put ${entry.userName} back in line.`
    })
  }
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

  if (loading) return <div className="page"><h1>Queue management</h1><p role="status" className="loading">Loading queue…</p></div>
  if (error) return <div className="page"><h1>Queue management</h1><p role="alert">{error}</p><button type="button" onClick={refresh}>Retry</button></div>

  return (
    <div className="page">
      <h1>Queue management</h1>
      <label>Service{' '}
        <select value={serviceId} disabled={busy} onChange={event => setParams({ serviceId: event.target.value })}>
          {services.map(service => <option key={service.id} value={service.id}>{service.name}{service.open ? '' : ' (closed)'}</option>)}
        </select>
      </label>
      <p>{entries.length} in line{service ? `, about ${service.expectedDuration} min each` : ''}.</p>
      <button type="button" disabled={busy} onClick={refresh}>Refresh</button>
      {services.length === 0 ? <p>No services available. Create a service first.</p> : null}
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
          }}>{busy ? 'Updating…' : entries.some(entry => entry.status === 'serving') ? 'Finish and call next' : 'Call next'}</button>
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>{entries.map((entry, index) => (
              <tr key={entry.id}>
                <td>{entry.position === 0 ? 'Serving' : entry.position}</td><td>{entry.userName}</td>
                <td><StatusBadge status={entry.status} /></td>
                <td>{formatTime(entry.joinedAt)}</td>
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
                  {entry.status === 'serving' ? (
                    <button type="button" disabled={busy} onClick={() => setRequeuing(entry)}>Put back in line</button>
                  ) : null}{' '}
                  {entry.status !== 'serving' ? <label>Priority for {entry.userName}{' '}
                    <select aria-label={`Priority for ${entry.userName}`} value={entry.priority} disabled={busy} onChange={event => {
                      const priority = event.target.value as Priority
                      void runAction(async () => {
                        await setQueuePriority(entry.serviceId, entry.id, priority)
                        return `Updated ${entry.userName}'s priority to ${priority}.`
                      })
                    }}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                    </select>
                  </label> : null}{' '}
                  <button type="button" disabled={busy} onClick={() => setRemoving(entry)}>Remove</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </>
      )}
      <ConfirmModal open={requeuing !== null} title="Put back in line?" message={`Put ${requeuing?.userName ?? ''} back in line for ${service?.name ?? 'this queue'}?`}
        confirmLabel="Put back in line" onConfirm={confirmRequeue} onCancel={() => setRequeuing(null)} />
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
