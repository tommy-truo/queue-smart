import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../api.ts'
import type { Service } from '../../types.ts'

type ServiceSummary = Service & { queueLength: number }

export default function AdminDashboard() {
  const [services, setServices] = useState<ServiceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api<ServiceSummary[]>('/services')
      .then(data => { if (active) setServices(data) })
      .catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load services.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  function retry() {
    setLoading(true)
    setLoadError('')
    setReload(value => value + 1)
  }

  async function toggleOpen(id: string) {
    if (savingId) return
    const service = services.find((s) => s.id === id)
    if (!service) return
    setMessage('')
    setActionError('')
    setSavingId(id)
    try {
      const saved = await api<Service>(`/services/${encodeURIComponent(id)}`, { method: 'PUT', body: { open: !service.open } })
      // PUT returns service fields; retain the queue summary supplied by GET.
      setServices(previous => previous.map(item => item.id === id ? { ...item, ...saved } : item))
      setMessage(`${saved.name} queue is now ${saved.open ? 'open' : 'closed'}.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update the service.')
    } finally {
      setSavingId(null)
    }
  }

  const totalWaiting = services.reduce((total, service) => total + service.queueLength, 0)
  const openCount = services.filter((s) => s.open).length

  if (loading) return <div className="page"><h1>Admin Dashboard</h1><p role="status">Loading services…</p></div>
  if (loadError) return <div className="page"><h1>Admin Dashboard</h1><p role="alert">{loadError}</p><button type="button" onClick={retry}>Retry</button></div>

  return (
    <div className="page">
      <h1>Admin Dashboard</h1>
      <p>
        {openCount} of {services.length} queues open, {totalWaiting} people in line.
      </p>

      {message ? <p role="status">{message}</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
      {services.length === 0 ? <p>No services yet. <Link to="/admin/services">Create a service</Link>.</p> : null}

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
              <td>{s.queueLength}</td>
              <td>{s.open ? 'Open' : 'Closed'}</td>
              <td>
                <button type="button" disabled={savingId !== null} onClick={() => toggleOpen(s.id)}>
                  {savingId === s.id ? 'Saving…' : s.open ? 'Close queue' : 'Open queue'}
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
