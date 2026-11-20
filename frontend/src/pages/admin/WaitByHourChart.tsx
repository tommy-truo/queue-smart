import { useEffect, useState } from 'react'
import { api } from '../../api.ts'
import './waitByHourChart.css'

type Row = { hour: number; visits: number; averageWait: number }

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM'
  return `${hour % 12 || 12} ${suffix}`
}

/** A round step for the minutes scale that gives about four gridlines. */
function tickStep(max: number): number {
  const rough = max / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map(m => m * magnitude).find(s => s >= rough)!
  return Math.max(1, step)
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
  const peak = rows.reduce<Row | undefined>((best, row) => !best || row.averageWait > best.averageWait ? row : best, undefined)
  const step = tickStep(max)
  const top = Math.ceil(max / step) * step
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step)

  let body
  if (loadedQuery !== query) body = <p role="status" className="loading">Loading chart…</p>
  else if (error) body = <p role="alert">{error}</p>
  else if (rows.length === 0) body = <p>No finished visits for these filters.</p>
  else
    body = (
      <div className="wait-chart__frame">
        <div className="wait-chart__y" aria-hidden="true">
          {ticks.map(t => <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>{t === top ? `${t} min` : t}</span>)}
        </div>
        <div
          className="wait-chart__plot"
          role="img"
          aria-label={`Average wait by hour. Longest at ${hourLabel(peak!.hour)}, ${peak!.averageWait} minutes.`}
        >
          {ticks.slice(1).map(t => <div key={t} className="wait-chart__grid" style={{ bottom: `${(t / top) * 100}%` }} />)}
          {rows.map(r => (
            <div key={r.hour} className={`wait-chart__col${r === peak ? ' wait-chart__col--peak' : ''}`} tabIndex={0}>
              {r === peak && <span className="wait-chart__value">{r.averageWait} min</span>}
              <div className="wait-chart__bar" style={{ height: `${(r.averageWait / top) * 100}%` }}>
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
      </div>
    )

  return (
    <section className="wait-chart">
      <h2>Average wait by time of day</h2>
      <p className="wait-chart__note">How long people waited to be called, by the time of day they joined.</p>
      {body}
    </section>
  )
}
