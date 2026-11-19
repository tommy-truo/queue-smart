import { useEffect, useState } from 'react'
import { api, download } from '../../api.ts'
import { capitalize, formatDate } from '../../format.ts'
import type { Service } from '../../types.ts'
import WaitByHourChart from './WaitByHourChart.tsx'

type ReportType = 'participation' | 'services'

type ParticipationRow = { userName: string; email: string; serviceName: string; date: string; outcome: string }

type ServiceActivityRow = {
  serviceName: string
  expectedDuration: number
  priority: string
  queueStatus: string
  waitingNow: number
  served: number
  left: number
  removed: number
  averageWait: number | null
}

const titles: Record<ReportType, string> = {
  participation: 'User participation',
  services: 'Service activity',
}

export default function Reports() {
  const [type, setType] = useState<ReportType>('services')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [services, setServices] = useState<Service[]>([])
  const [rows, setRows] = useState<ParticipationRow[] | ServiceActivityRow[]>([])
  // Which request the shown rows belong to, so loading is just "not caught up yet".
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState('')

  const query = new URLSearchParams({ from, to, serviceId }).toString()
  const key = `${type}?${query}`
  const loading = loadedKey !== key

  useEffect(() => {
    api<Service[]>('/services').then(setServices).catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    api<ParticipationRow[] | ServiceActivityRow[]>(`/reports/${key}`)
      .then(data => { if (active) { setRows(data); setError('') } })
      .catch(err => { if (active) { setRows([]); setError(err instanceof Error ? err.message : 'Could not load the report.') } })
      .finally(() => { if (active) setLoadedKey(key) })
    return () => { active = false }
  }, [key])

  async function exportCsv() {
    setError('')
    try {
      await download(`/reports/${key}&format=csv`, `${type}-report.csv`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the report.')
    }
  }

  return (
    <div className="page">
      <h1>Reports</h1>

      <p>
        <label>
          Report{' '}
          <select value={type} onChange={e => setType(e.target.value as ReportType)}>
            <option value="services">{titles.services}</option>
            <option value="participation">{titles.participation}</option>
          </select>
        </label>{' '}
        <label>
          From <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>{' '}
        <label>
          To <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>{' '}
        <label>
          Service{' '}
          <select value={serviceId} onChange={e => setServiceId(e.target.value)}>
            <option value="">All services</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>{' '}
        <button type="button" className="primary" onClick={exportCsv}>Download CSV</button>
      </p>

      <WaitByHourChart query={query} />

      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading report…</p>
      ) : rows.length === 0 ? (
        <p>No data for these filters.</p>
      ) : type === 'participation' ? (
        <table>
          <thead>
            <tr><th>User</th><th>Email</th><th>Service</th><th>Date</th><th>Outcome</th></tr>
          </thead>
          <tbody>
            {(rows as ParticipationRow[]).map((r, i) => (
              <tr key={i}><td>{r.userName}</td><td>{r.email}</td><td>{r.serviceName}</td><td>{formatDate(r.date)}</td><td>{capitalize(r.outcome)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Service</th><th>Expected (min)</th><th>Priority</th><th>Queue status</th><th>Waiting now</th>
              <th>Served</th><th>Left</th><th>Removed</th><th>Average wait (min)</th>
            </tr>
          </thead>
          <tbody>
            {(rows as ServiceActivityRow[]).map(r => (
              <tr key={r.serviceName}>
                <td>{r.serviceName}</td><td>{r.expectedDuration}</td><td>{capitalize(r.priority)}</td><td>{capitalize(r.queueStatus)}</td>
                <td>{r.waitingNow}</td><td>{r.served}</td><td>{r.left}</td><td>{r.removed}</td>
                <td>{r.averageWait ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
