import { useState } from 'react'
import { Link } from 'react-router'
import { queueEntries, services as mockServices } from '../../mock/data.ts'

export default function AdminDashboard() {
  // UI only: opening or closing a queue changes local state, not the mock data.
  const [services, setServices] = useState(mockServices)
  const [message, setMessage] = useState('')

  function toggleOpen(id: string) {
    const service = services.find((s) => s.id === id)
    if (!service) return
    setServices(services.map((s) => (s.id === id ? { ...s, open: !s.open } : s)))
    setMessage(`${service.name} queue is now ${service.open ? 'closed' : 'open'}.`)
  }

  const totalWaiting = queueEntries.length
  const openCount = services.filter((s) => s.open).length

  return (
    <div className="page">
      <h1>Admin Dashboard</h1>
      <p>
        {openCount} of {services.length} queues open, {totalWaiting} people in line.
      </p>

      {message ? <p role="status">{message}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Priority</th>
            <th>In line</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.priority}</td>
              <td>{queueEntries.filter((e) => e.serviceId === s.id).length}</td>
              <td>{s.open ? 'Open' : 'Closed'}</td>
              <td>
                <button type="button" onClick={() => toggleOpen(s.id)}>
                  {s.open ? 'Close queue' : 'Open queue'}
                </button>{' '}
                <Link to="/admin/queue">View queue</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        <Link to="/admin/services">Create or edit services</Link>
      </p>
    </div>
  )
}
