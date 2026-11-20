import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../api.ts'
import { capitalize } from '../../format.ts'
import type { Service } from '../../types.ts'
import LiveBoard from './LiveBoard.tsx'

type ServiceSummary = Service & { queueLength: number }

export default function AdminDashboard() {
  const [services, setServices] = useState<ServiceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const saving = useRef(false)
  const request = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    let active = true
    async function load() {
      if (saving.current) return
      request.current?.abort()
      const controller = new AbortController()
      request.current = controller
      try {
        const data = await api<ServiceSummary[]>('/services', { signal: controller.signal })
        if (active && !controller.signal.aborted) { setServices(data); setLoadError('') }
      } catch (error) {
        if (active && !controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load services.')
      } finally {
        if (active && !controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    const timer = window.setInterval(load, 5000)
    window.addEventListener('focus', load)
    return () => { active = false; request.current?.abort(); window.clearInterval(timer); window.removeEventListener('focus', load) }
  }, [reload])

  function retry() {
    setLoadError('')
    setReload(value => value + 1)
  }

  async function toggleOpen(id: string) {
    if (saving.current) return
    const service = services.find((s) => s.id === id)
    if (!service) return
    setMessage('')
    setActionError('')
    saving.current = true
    request.current?.abort()
    setSavingId(id)
    try {
      const saved = await api<Service>(`/services/${encodeURIComponent(id)}`, { method: 'PUT', body: { open: !service.open } })
      // PUT returns service fields; retain the queue summary supplied by GET.
      setServices(previous => previous.map(item => item.id === id ? { ...item, ...saved } : item))
      setMessage(`${saved.name} queue is now ${saved.open ? 'open' : 'closed'}.`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update the service.')
    } finally {
      saving.current = false
      setSavingId(null)
      setReload(value => value + 1)
    }
  }

  const totalWaiting = services.reduce((total, service) => total + service.queueLength, 0)
  const openCount = services.filter((s) => s.open).length

  if (loading) return <div className="page"><h1>Admin dashboard</h1><p role="status" className="loading">Loading services…</p></div>
  if (loadError && services.length === 0) return <div className="page"><h1>Admin dashboard</h1><p role="alert">{loadError}</p><button type="button" onClick={retry}>Retry</button></div>

  return (
    <div className="page">
      <h1>Admin dashboard</h1>
      <p>
        {openCount} of {services.length} queues open, {totalWaiting} people in line.
      </p>

      {loadError ? <p role="alert">{loadError}</p> : null}
      <button type="button" onClick={retry}>Refresh</button>
      <LiveBoard />

      <h2>Services</h2>
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
              <td>{capitalize(s.priority)}</td>
              <td>{s.queueLength}</td>
              <td>{s.open ? 'Open' : 'Closed'}</td>
              <td>
                <div className="row-actions">
                  <button type="button" disabled={savingId !== null} onClick={() => toggleOpen(s.id)}>
                    {savingId === s.id ? 'Saving…' : s.open ? 'Close queue' : 'Open queue'}
                  </button>
                  <Link to={`/admin/queue?serviceId=${encodeURIComponent(s.id)}`}>View queue</Link>
                </div>
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
