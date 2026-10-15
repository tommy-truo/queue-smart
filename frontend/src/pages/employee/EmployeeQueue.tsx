import { useCallback, useEffect, useRef, useState } from 'react'
import { queueEntries, services } from '../../mock/data.ts'
import type { QueueEntry } from '../../types.ts'
import { waitSince } from './formatWait.ts'
import './employeeQueue.css'

const SERVICE_ID = 's1' //Hard-coded to Academic Advising, remove and change to allow dynamic queue selection

function initEntries(): QueueEntry[] {
  return queueEntries
    .filter((e) => e.serviceId === SERVICE_ID)
    .map((e) => ({ ...e }))
}

function isWaitingInLine(entry: QueueEntry): boolean {
  if (entry.outcome) return false
  return entry.status === 'waiting' || entry.status === 'almost-ready'
}

function isServing(entry: QueueEntry): boolean {
  return !entry.outcome && entry.status === 'serving'
}

export default function EmployeeQueue() {
  const service = services.find((s) => s.id === SERVICE_ID)
  const [entries, setEntries] = useState<QueueEntry[]>(initEntries)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const serveNextBlockedUntil = useRef(0)

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const serving = entries.find(isServing) ?? null
  const waiting = entries
    .filter(isWaitingInLine)
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())

  const chairEmpty = serving === null
  const actionLabel = chairEmpty ? 'Serve next' : 'Finish serving'
  const actionDisabled = chairEmpty && waiting.length === 0

  const handlePrimaryAction = useCallback(() => {
    if (Date.now() < serveNextBlockedUntil.current) return

    if (serving) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === serving.id ? { ...e, status: 'served', outcome: 'served' } : e,
        ),
      )
      for(let e of queueEntries){
        if(e.id === serving.id) {
          e.status = 'served'
          e.outcome = 'served'
        }
      }
      serveNextBlockedUntil.current = Date.now() + 400
      return
    }

    if (waiting.length === 0) return
    const next = waiting[0]
    const calledAt = new Date().toISOString()
    setEntries((prev) =>
      prev.map((e) => (e.id === next.id ? { ...e, status: 'serving', calledAt } : e)),
    )
    for(let e of queueEntries){
      if(e.id === next.id) e.status = 'serving'
    }
  }, [serving, waiting])

  function handleRemove(entry: QueueEntry) {
    const ok = window.confirm(`Remove ${entry.userName} from the queue?`)
    if (!ok) return
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, outcome: 'removed' } : e)),
    )
    for(let e of queueEntries){
      if(e.id === entry.id) e.outcome = 'removed'
    }
  }

  function handleRequeue(entry: QueueEntry) {
    const joinedAt = new Date().toISOString()
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id
          ? { ...e, status: 'waiting', joinedAt, calledAt: undefined }
          : e,
      ),
    )
    for(let e of queueEntries){
      if(e.id === entry.id){ 
        e.status = 'waiting'
        e.calledAt = undefined
      }
    }
  }

  const title = service ? `${service.name}` : 'Queue'

  return (
    <section className="employee-queue">
      <h1>{title}</h1>

      <div className="employee-queue__now-serving">
        <p className="employee-queue__now-serving-label">Now serving</p>
        {serving ? (
          <div className="employee-queue__serving-row">
            <span className="employee-queue__serving-name">{serving.userName}</span>
            <button
              type="button"
              className="employee-queue__remove-btn"
              onClick={() => handleRequeue(serving)}
            >
              Requeue
            </button>
          </div>
        ) : (
          <p className="employee-queue__now-serving-empty">No one being served</p>
        )}
      </div>

      <div className="employee-queue__action-wrap">
        <button
          type="button"
          className="employee-queue__primary-btn"
          disabled={actionDisabled}
          onClick={handlePrimaryAction}
        >
          {actionLabel}
        </button>
      </div>

      <h2 className="employee-queue__list-heading">Waiting</h2>
      {waiting.length === 0 ? (
        <p className="employee-queue__list-empty">No one is waiting</p>
      ) : (
        <ul className="employee-queue__list">
          {waiting.map((entry, index) => (
            <li key={entry.id} className="employee-queue__list-item">
              <span className="employee-queue__position">{index + 1}.</span>
              <span className="employee-queue__serving-name">{entry.userName}</span>
              <span className="employee-queue__wait">
                {waitSince(entry.joinedAt, nowMs)}
              </span>
              <button
                type="button"
                className="employee-queue__remove-btn"
                onClick={() => handleRemove(entry)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
