import { useEffect, useState } from 'react'
import { api } from '../../api.ts'
import './waitByHourChart.css'

type Row = { hour: number; visits: number; averageWait: number }

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM'
  return `${hour % 12 || 12} ${suffix}`
}

/** Bar chart of the average actual wait by the hour people joined. Takes the same filters as the reports. */
export default function WaitByHourChart({ query }: { query: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api<Row[]>(`/reports/wait-by-hour?${query}`)
      .then(data => { if (active) { setRows(data); setError('') } })
      .catch(err => { if (active) { setRows([]); setError(err instanceof Error ? err.message : 'Could not load the chart.') } })
      .finally(() => { if (active) setLoadedQuery(query) })
    return () => { active = false }
  }, [query])

  const max = Math.max(1, ...rows.map(r => r.averageWait))
  const peak = rows.find(r => r.averageWait === max)

  let body
  if (loadedQuery !== query) body = <p role="status">Loading chart…</p>
  else if (error) body = <p role="alert">{error}</p>
  else if (rows.length === 0) body = <p>No finished visits for these filters.</p>
  else
    body = (
      <>
        <div
          className="wait-chart__plot"
          role="img"
          aria-label={`Average wait by hour. Longest at ${hourLabel(peak!.hour)}, ${peak!.averageWait} minutes.`}
        >
          {rows.map(r => (
            <div key={r.hour} className="wait-chart__col" tabIndex={0}>
              {r === peak && <span className="wait-chart__value">{r.averageWait} min</span>}
              <div className="wait-chart__bar" style={{ height: `${(r.averageWait / max) * 100}%` }}>
                <span className="wait-chart__tip" role="tooltip">
                  <strong>{hourLabel(r.hour)}</strong>
                  <br />
                  {r.averageWait} min average wait
                  <br />
                  {r.visits} visits served
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="wait-chart__axis" aria-hidden="true">
          {rows.map(r => <span key={r.hour}>{hourLabel(r.hour)}</span>)}
        </div>
      </>
    )

  return (
    <section className="wait-chart">
      <h2>Average wait by time of day</h2>
      <p className="wait-chart__note">Minutes from joining a queue to being called, by the hour people joined.</p>
      {body}
    </section>
  )
}
