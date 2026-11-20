import { useEffect, useRef, useState } from 'react'
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
  const track = useRef<HTMLDivElement>(null)

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

  /** Scrolls the carousel by one column. */
  function scroll(direction: 1 | -1) {
    const column = track.current?.querySelector('.live-queue')
    if (column) track.current?.scrollBy({ left: direction * (column.clientWidth + 12), behavior: 'smooth' })
  }

  return (
    <section className="live-board" aria-labelledby="live-board-title">
      <div className="live-board__head">
        <h2 id="live-board-title">Live queues</h2>
        <span className="live-board__live">Live</span>
        <span className="live-board__info">
          <button type="button" aria-label="What the timer colours mean" aria-describedby="live-board-legend">i</button>
          <span id="live-board-legend" role="tooltip" className="live-board__legend">
            <span className="live-board__key live-board__key--long">Waited 2× the service time</span>
            <span className="live-board__key live-board__key--very-long">Waited 3× the service time</span>
          </span>
        </span>
        <span className="live-board__nav">
          <button type="button" aria-label="Previous queues" onClick={() => scroll(-1)}>‹</button>
          <button type="button" aria-label="More queues" onClick={() => scroll(1)}>›</button>
        </span>
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {queues === null && !error ? <p role="status" className="loading">Loading queues…</p> : null}
      {queues?.length === 0 ? <p>No queues are open right now.</p> : null}

      {queues && queues.length > 0 ? (
        <div className="live-board__track" ref={track}>
          {queues.map(queue => (
            <div key={queue.id} className="live-queue">
              <div className="live-queue__head">
                <h3>{queue.name}</h3>
                <p>{queue.queueLength} in line · joins wait ~{queue.estimatedWait} min</p>
              </div>

              {queue.entries.length === 0 ? (
                <p className="live-queue__empty">No one in line</p>
              ) : (
                <ol className="live-queue__list">
                  {queue.entries.map(entry => {
                    const serving = entry.status === 'serving'
                    const waited = seconds(serving && entry.calledAt ? entry.calledAt : entry.joinedAt)
                    const level = serving ? '' : waitLevel(waited, queue.expectedDuration)
                    return (
                      <li
                        key={entry.id}
                        className={`live-person${serving ? ' live-person--serving' : ''}${level ? ` live-person--${level}` : ''}`}
                        title={note(entry)}
                      >
                        <span className="live-person__position">{serving ? 'Now' : entry.position}</span>
                        <span className="live-person__name">{entry.userName}</span>
                        <span className="live-person__timer">{clock(waited)}</span>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
