import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../api.ts'
import { useAuth } from '../../auth/AuthContext.ts'
import StatusBadge from '../../components/StatusBadge.tsx'
import type { AppNotification } from '../../types.ts'
import type { QueueView, ServiceSummary } from '../../queues.ts'

type DashboardData = {
  entries: QueueView[]
  services: ServiceSummary[]
  notifications: AppNotification[]
}

export default function UserDashboard() {
  const { user } = useAuth()
  // Clear rows and notifications immediately when the signed-in account changes.
  return <Dashboard key={user?.id ?? 'guest'} fullName={user?.fullName} />
}

function Dashboard({ fullName }: { fullName?: string }) {
  const [{ entries, services, notifications }, setData] = useState<DashboardData>({ entries: [], services: [], notifications: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      api<QueueView[]>('/queues/mine'),
      api<ServiceSummary[]>('/services'),
      api<AppNotification[]>('/me/notifications'),
    ])
      .then(([entries, services, notifications]) => {
        if (active) setData({ entries, services, notifications })
      })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Could not load your dashboard.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])

  function refresh() {
    setLoading(true)
    setError('')
    setRevision(value => value + 1)
  }

  const openServices = services.filter((s) => s.open)
  const unread = notifications.filter((n) => !n.read)

  if (loading) return <div className="page"><h1>Welcome{fullName ? `, ${fullName}` : ''}</h1><p role="status">Loading dashboard…</p></div>
  if (error) return <div className="page"><h1>Welcome{fullName ? `, ${fullName}` : ''}</h1><p role="alert">{error}</p><button type="button" onClick={refresh}>Retry</button></div>

  return (
    <div className="page">
      <h1>Welcome{fullName ? `, ${fullName}` : ''}</h1>
      <button type="button" onClick={refresh}>Refresh</button>

      <section className="card">
        <h2>{entries.length > 1 ? 'Current queues' : 'Current queue'}</h2>
        {entries.length > 0 ? entries.map(entry => {
          const service = services.find(service => service.id === entry.serviceId)
          // The API estimate includes the serving chair, unlike its position number.
          const peopleAhead = service ? Math.max(0, Math.round(entry.estimatedWait / service.expectedDuration)) : 0
          return (
            <p key={entry.id}>
              {service?.name ?? 'Service'}: <StatusBadge status={entry.status} />.{' '}
              {entry.status !== 'serving' ? <>Position <strong>#{entry.position}</strong>, with {peopleAhead} {peopleAhead === 1 ? 'person' : 'people'} ahead of you. </> : null}
              Estimated wait: {entry.estimatedWait} min. <Link to="/status">View status</Link>
            </p>
          )
        }) : (
          <p>
            You are not in a queue. <Link to="/join">Join one</Link>
          </p>
        )}
      </section>

      <section className="card">
        <h2>Open services</h2>
        {openServices.length === 0 ? <p>No services are open right now.</p> : null}
        <ul>
          {openServices.map((s) => (
            <li key={s.id}>
              {s.name}: {s.queueLength} in line,
              ~{s.expectedDuration} min each
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Notifications ({unread.length} unread)</h2>
        {notifications.length === 0 ? <p>No notifications yet.</p> : null}
        <ul>
          {notifications.map((n) => (
            <li key={n.id} className={n.read ? undefined : 'unread'}>
              {n.message} <small>{new Date(n.createdAt).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
