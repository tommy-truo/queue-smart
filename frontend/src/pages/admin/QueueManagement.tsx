import { useState } from 'react'
import StatusBadge from '../../components/StatusBadge.tsx'
import { serveNext, useQueues } from '../../queues.ts'

export default function QueueManagement() {
  const [serviceId, setServiceId] = useState('s1')
  const { services, entries, loading, error, busy, message, actionError, refresh, runAction } = useQueues(serviceId)
  const service = services.find(service => service.id === serviceId)

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
                  <button type="button" disabled title="Removal is not available yet">Remove</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </>
      )}
    </div>
  )
}
