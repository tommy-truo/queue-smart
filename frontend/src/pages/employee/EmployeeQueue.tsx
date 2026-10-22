import { useEffect, useState } from 'react'
import ConfirmModal from '../../components/ConfirmModal.tsx'
import { removeFromQueue, requeue, serveNext, useQueues, type QueueView } from '../../queues.ts'
import { waitSince } from './formatWait.ts'
import './employeeQueue.css'

const SERVICE_ID = 's1'

export default function EmployeeQueue() {
  const { services, entries, loading, error, busy, message, actionError, refresh, runAction } = useQueues(SERVICE_ID)
  const [removing, setRemoving] = useState<QueueView | null>(null)
  const [requeuing, setRequeuing] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const serving = entries.find(entry => entry.status === 'serving')
  // Preserve the backend's priority/arrival ordering.
  const waiting = entries.filter(entry => entry.status !== 'serving')
  const service = services.find(service => service.id === SERVICE_ID)

  function confirmRequeue() {
    if (!serving) return
    const name = serving.userName
    setRequeuing(false)
    void runAction(async () => {
      await requeue(SERVICE_ID)
      return `Placed ${name} back in line.`
    })
  }

  function confirmRemove() {
    if (!removing) return
    const entry = removing
    setRemoving(null)
    void runAction(async () => {
      await removeFromQueue(SERVICE_ID, entry.id)
      return `Removed ${entry.userName}.`
    })
  }

  if (loading) return <section className="employee-queue"><h1>Queue</h1><p role="status">Loading queue…</p></section>
  if (error) return <section className="employee-queue"><h1>Queue</h1><p role="alert">{error}</p><button type="button" onClick={refresh}>Retry</button></section>

  return (
    <section className="employee-queue">
      <h1>{service?.name ?? 'Queue'}</h1>
      {message ? <p role="status">{message}</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
      <div className="employee-queue__now-serving">
        <p className="employee-queue__now-serving-label">Now serving</p>
        {serving ? (
          <div className="employee-queue__serving-row">
            <span className="employee-queue__serving-name">{serving.userName}</span>
            <button type="button" className="employee-queue__remove-btn" disabled={busy} onClick={() => setRequeuing(true)}>Requeue</button>
          </div>
        ) : <p className="employee-queue__now-serving-empty">No one being served</p>}
      </div>
      <div className="employee-queue__action-wrap">
        <button type="button" className="employee-queue__primary-btn" disabled={busy || entries.length === 0} onClick={event => {
          if (event.detail > 1) return
          void runAction(async () => {
          const result = await serveNext(SERVICE_ID)
          return [result.served ? `Served ${result.served.userName}.` : '', result.nowServing ? `Now serving ${result.nowServing.userName}.` : 'The queue is now empty.'].filter(Boolean).join(' ')
          })
        }}>{busy ? 'Updating…' : serving ? 'Finish serving and call next' : 'Serve next'}</button>
      </div>
      <h2 className="employee-queue__list-heading">Waiting</h2>
      {waiting.length === 0 ? <p className="employee-queue__list-empty">No one is waiting</p> : (
        <ul className="employee-queue__list">{waiting.map((entry, index) => (
          <li key={entry.id} className="employee-queue__list-item">
            <span className="employee-queue__position">{index + 1}.</span>
            <span className="employee-queue__serving-name">{entry.userName}</span>
            <span className="employee-queue__wait">{waitSince(entry.joinedAt, nowMs)}</span>
            <button type="button" className="employee-queue__remove-btn" disabled={busy} onClick={() => setRemoving(entry)}>Remove</button>
          </li>
        ))}</ul>
      )}
      <ConfirmModal open={requeuing} title="Place back in line?" message={`Place ${serving?.userName ?? ''} back in line for ${service?.name ?? 'this queue'}?`}
        confirmLabel="Requeue" onConfirm={confirmRequeue} onCancel={() => setRequeuing(false)} />
      <ConfirmModal open={removing !== null} title="Remove from queue?" message={`Remove ${removing?.userName ?? ''} from ${service?.name ?? 'this queue'}?`}
        confirmLabel="Remove" onConfirm={confirmRemove} onCancel={() => setRemoving(null)} />
    </section>
  )
}
