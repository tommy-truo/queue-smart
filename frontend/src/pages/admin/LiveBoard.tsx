import { useEffect, useState } from 'react'
import { api } from '../../api.ts'
import type { QueueView, ServiceSummary } from '../../queues.ts'
import './liveBoard.css'

type OpenQueue = ServiceSummary & { entries: QueueView[] }

const REFRESH_MS = 5000

/** "4:05" or "1:02:09" for a number of seconds. */
function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = String(s % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

/** Timer colour: long once someone has waited twice the service time, very long at three times. */
function waitLevel(seconds: number, expectedMinutes: number): string {
  const minutes = seconds / 60
  if (minutes >= expectedMinutes * 3) return 'very-long'
  if (minutes >= expectedMinutes * 2) return 'long'
  return ''
}

function note(entry: QueueView): string {
  if (entry.status === 'serving') return 'Being served'
  if (entry.status === 'almost-ready') return 'Up next'
  return `About ${entry.estimatedWait} min to go`
}

/** Every open queue side by side, with a ticking wait time for each person. Refreshes every few seconds. */
export default function LiveBoard() {
  const [queues, setQueues] = useState<OpenQueue[] | null>(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    const load = () =>
      api<OpenQueue[]>('/queues')
        .then(data => { if (active) { setQueues(data); setError('') } })
        .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load the live queues.') })
    load()
    const refresh = setInterval(load, REFRESH_MS)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => { active = false; clearInterval(refresh); clearInterval(tick) }
  }, [])

  const seconds = (since: string) => (now - new Date(since).getTime()) / 1000

  return (
    <section className="live-board" aria-labelledby="live-board-title">
      <div className="live-board__head">
        <h2 id="live-board-title">Live queues</h2>
        <span className="live-board__live">Live</span>
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {queues === null && !error ? <p role="status" className="loading">Loading queues…</p> : null}
      {queues?.length === 0 ? <p>No queues are open right now.</p> : null}

      <div className="live-board__grid">
        {queues?.map(queue => (
          <article key={queue.id} className="live-queue">
            <header className="live-queue__head">
              <h3>{queue.name}</h3>
              <p>
                {queue.queueLength} in line · new joins wait about {queue.estimatedWait} min
              </p>
            </header>

            {queue.entries.length === 0 ? (
              <p className="live-queue__empty">No one in line.</p>
            ) : (
              <ol className="live-queue__list">
                {queue.entries.map(entry => {
                  const serving = entry.status === 'serving'
                  const waited = seconds(serving && entry.calledAt ? entry.calledAt : entry.joinedAt)
                  const level = serving ? '' : waitLevel(waited, queue.expectedDuration)
                  return (
                    <li key={entry.id} className={`live-person${serving ? ' live-person--serving' : ''}`}>
                      <span className="live-person__position" aria-label={serving ? 'Being served' : `Position ${entry.position}`}>
                        {serving ? '●' : entry.position}
                      </span>
                      <span className="live-person__info">
                        <span className="live-person__name">{entry.userName}</span>
                        <span className="live-person__note">{note(entry)}</span>
                      </span>
                      <span
                        className={`live-person__timer${level ? ` live-person__timer--${level}` : ''}`}
                        title={serving ? 'Time since called' : 'Time waiting'}
                      >
                        {clock(waited)}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </article>
        ))}
      </div>

      {queues && queues.length > 0 ? (
        <p className="live-board__legend">
          Timers show time waiting, or time since being called for the person being served.
          <span className="live-board__key live-board__key--long">2× service time</span>
          <span className="live-board__key live-board__key--very-long">3× service time</span>
        </p>
      ) : null}
    </section>
  )
}
