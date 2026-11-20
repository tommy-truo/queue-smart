import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import ConfirmModal from '../../components/ConfirmModal.tsx'
import { removeFromQueue, requeue, serveNext, useQueues, type QueueView } from '../../queues.ts'
import { waitSince } from './formatWait.ts'
import './employeeQueue.css'

export default function EmployeeQueue() {
  const [params, setParams] = useSearchParams()
  const requestedServiceId = params.get('serviceId') ?? ''
  const { services, entries, loading, error, busy, message, actionError, refresh, runAction, selectedServiceId: serviceId } = useQueues(requestedServiceId)
  const [removing, setRemoving] = useState<QueueView | null>(null)
  const [requeuing, setRequeuing] = useState<QueueView | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const serving = entries.find(entry => entry.status === 'serving')
  // Preserve the backend's priority/arrival ordering.
  const waiting = entries.filter(entry => entry.status !== 'serving')
  const service = services.find(service => service.id === serviceId)

  function confirmRequeue() {
    if (!requeuing) return
    const entry = requeuing
    const name = entry.userName
    setRequeuing(null)
    void runAction(async () => {
      if (serving?.id !== entry.id) throw new Error('The person being served changed. Review the queue and try again.')
      await requeue(entry.serviceId)
      return `Put ${name} back in line.`
    })
  }

  function confirmRemove() {
    if (!removing) return
    const entry = removing
    setRemoving(null)
    void runAction(async () => {
      await removeFromQueue(serviceId, entry.id)
      return `Removed ${entry.userName}.`
    })
  }

  if (loading) return <section className="employee-queue"><h1>Queue</h1><p role="status" className="loading">Loading queue…</p></section>
  if (error) return <section className="employee-queue"><h1>Queue</h1><p role="alert">{error}</p><button type="button" onClick={refresh}>Retry</button></section>

  return (
    <section className="employee-queue">
      <h1>Queue</h1>
      <label>Service{' '}
        <select value={serviceId} disabled={busy} onChange={event => setParams({ serviceId: event.target.value })}>
          {services.map(service => <option key={service.id} value={service.id}>{service.name}{service.open ? '' : ' (closed)'}</option>)}
        </select>
      </label>
      <button type="button" disabled={busy} onClick={refresh}>Refresh</button>
      {services.length === 0 ? <p>No services available. Create a service first.</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
      <div className="employee-queue__now-serving">
        <p className="employee-queue__now-serving-label">Now serving</p>
        {serving ? (
          <div className="employee-queue__serving-row">
            <span className="employee-queue__serving-name">{serving.userName}</span>
            <button type="button" className="employee-queue__remove-btn" disabled={busy} onClick={() => setRequeuing(serving)}>Put back in line</button>
          </div>
        ) : <p className="employee-queue__now-serving-empty">No one is being served.</p>}
      </div>
      <div className="employee-queue__action-wrap">
        <button type="button" className="employee-queue__primary-btn" disabled={busy || entries.length === 0} onClick={event => {
          if (event.detail > 1) return
          void runAction(async () => {
          const result = await serveNext(serviceId)
          return [result.served ? `Served ${result.served.userName}.` : '', result.nowServing ? `Now serving ${result.nowServing.userName}.` : 'The queue is now empty.'].filter(Boolean).join(' ')
          })
        }}>{busy ? 'Updating…' : serving ? 'Finish and call next' : 'Call next'}</button>
      </div>
      <h2 className="employee-queue__list-heading">Waiting</h2>
      {waiting.length === 0 ? <p className="employee-queue__list-empty">No one is waiting.</p> : (
        <ul className="employee-queue__list">{waiting.map((entry, index) => (
          <li key={entry.id} className="employee-queue__list-item">
            <span className="employee-queue__position">{index + 1}.</span>
            <span className="employee-queue__serving-name">{entry.userName}</span>
            <span className="employee-queue__wait">{waitSince(entry.joinedAt, nowMs)}</span>

                  <button type="button" className="employee-queue__remove-btn" disabled={busy} onClick={() => setRemoving(entry)}>Remove</button>
          </li>
        ))}</ul>
      )}
      <ConfirmModal open={requeuing !== null} title="Put back in line?" message={`Put ${requeuing?.userName ?? ''} back in line for ${service?.name ?? 'this queue'}?`}
        confirmLabel="Put back in line" onConfirm={confirmRequeue} onCancel={() => setRequeuing(null)} />
      <ConfirmModal open={removing !== null} title="Remove from queue?" message={`Remove ${removing?.userName ?? ''} from ${service?.name ?? 'this queue'}?`}
        confirmLabel="Remove" onConfirm={confirmRemove} onCancel={() => setRemoving(null)} />
    </section>
  )
}
