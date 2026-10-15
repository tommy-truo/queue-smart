import { useState } from 'react'
import StatusBadge from '../../components/StatusBadge.tsx'
import { queueEntries, services } from '../../mock/data.ts'
import type { QueueEntry, QueueStatus } from '../../types.ts'

// After the line changes, the front person is being served and the next one is almost ready.
function statusAt(index: number): QueueStatus {
  if (index === 0) return 'serving'
  if (index === 1) return 'almost-ready'
  return 'waiting'
}

export default function QueueManagement() {
  // UI only: reordering, removing and serving change local state, not the mock data.
  const [entries, setEntries] = useState(queueEntries)
  const [serviceId, setServiceId] = useState(services[0].id)
  const [message, setMessage] = useState('')

  const service = services.find((s) => s.id === serviceId)
  const queue = entries.filter((e) => e.serviceId === serviceId)

  function replaceQueue(next: QueueEntry[]) {
    const others = entries.filter((e) => e.serviceId !== serviceId)
    setEntries([...others, ...next.map((e, i) => ({ ...e, status: statusAt(i) }))])
  }

  function move(index: number, offset: number) {
    const next = [...queue]
    const [entry] = next.splice(index, 1)
    next.splice(index + offset, 0, entry)
    replaceQueue(next)
    setMessage(`Moved ${entry.userName} to position ${index + offset + 1}.`)
  }

  function remove(entry: QueueEntry) {
    replaceQueue(queue.filter((e) => e.id !== entry.id))
    setMessage(`Removed ${entry.userName} from the queue.`)
  }

  function serveNext() {
    const [served, ...rest] = queue
    replaceQueue(rest)
    setMessage(
      rest.length > 0
        ? `Served ${served.userName}. Now serving ${rest[0].userName}.`
        : `Served ${served.userName}. The queue is now empty.`,
    )
  }

  return (
    <div className="page">
      <h1>Queue Management</h1>

      <label>
        Service{' '}
        <select
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value)
            setMessage('')
          }}
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.open ? '' : ' (closed)'}
            </option>
          ))}
        </select>
      </label>

      <p>
        {queue.length} in line{service ? `, about ${service.expectedDuration} min each` : ''}.
      </p>

      {message ? <p role="status">{message}</p> : null}

      {queue.length === 0 ? (
        <p>No one is in this queue.</p>
      ) : (
        <>
          <button type="button" className="primary" onClick={serveNext}>
            Serve next
          </button>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((e, i) => (
                <tr key={e.id}>
                  <td>{i + 1}</td>
                  <td>{e.userName}</td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                  <td>{new Date(e.joinedAt).toLocaleTimeString([], { timeStyle: 'short' })}</td>
                  <td>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>
                      Up
                    </button>{' '}
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === queue.length - 1}
                    >
                      Down
                    </button>{' '}
                    <button type="button" onClick={() => remove(e)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
