import { useState } from 'react'
import { joinQueue, leaveQueue, useQueues } from '../../queues.ts'
import type { Service } from '../../types.ts'
import ConfirmModal from '../../components/ConfirmModal.tsx'
import LiveWait from '../../components/LiveWait.tsx'

export default function JoinQueue() {
  const [serviceId, setServiceId] = useState('')
  const [reminderMinutes, setReminderMinutes] = useState(10)
  const [leaving, setLeaving] = useState<Service | null>(null)
  const { services, entries, loading, error, busy, message, actionError, refresh, runAction } = useQueues()
  const selected = services.find(service => service.id === serviceId)
  const entry = entries.find(entry => entry.serviceId === serviceId)

  function confirmLeave() {
    if (!leaving) return
    const service = leaving
    setLeaving(null)
    void runAction(async () => {
      await leaveQueue(service.id)
      return `You left ${service.name}.`
    })
  }

  if (loading) return <div className="page"><h1>Join queue</h1><p role="status" className="loading">Loading queues…</p></div>
  if (error) return <div className="page"><h1>Join queue</h1><p role="alert">{error}</p><button type="button" onClick={refresh}>Retry</button></div>

  return (
    <div className="page">
      <h1>Join queue</h1>
      <button type="button" disabled={busy} onClick={refresh}>Refresh</button>
      {message ? <p role="status">{message}</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
      {services.length === 0 ? <p>No services available.</p> : <p>Choose a service to see its current wait and join the line.</p>}
      <label className="field">
        Service
        <select value={serviceId} disabled={busy} onChange={event => setServiceId(event.target.value)}>
          <option value="">Select a service</option>
          {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
        </select>
      </label>
      {selected ? (
        <div className="card">
          <h2>{selected.name}</h2>
          <p>{selected.description}</p>
          <p>Expected duration: {selected.expectedDuration} min</p>
          {entry ? (
            <>
              <p>Position: {entry.position === 0 ? 'Being served' : entry.position}. Estimated wait: <LiveWait entry={entry} /></p>
              <button type="button" disabled={busy} onClick={() => setLeaving(selected)}>Leave</button>
              <span className="note">You are already in this queue.</span>
            </>
          ) : (
            <>
              <p>Estimated wait: {selected.open ? `${selected.estimatedWait} min` : 'Closed'}</p>
              <label className="field">Remind me before service
                <select value={reminderMinutes} disabled={busy} onChange={event => setReminderMinutes(Number(event.target.value))}>
                  <option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={15}>15 minutes</option>
                </select>
              </label>
              <p className="note">One in-app reminder when your estimated wait reaches this time. Estimates may change.</p>
              <button type="button" className="primary" disabled={busy || !selected.open} onClick={() => void runAction(async () => {
                await joinQueue(selected.id, reminderMinutes)
                return `You joined ${selected.name}.`
              })}>Join</button>
              {!selected.open ? <span className="note">This queue is closed right now.</span> : null}
            </>
          )}
        </div>
      ) : null}
      <ConfirmModal open={leaving !== null} title="Leave queue?" message={`Leave the queue for ${leaving?.name}?`}
        confirmLabel="Leave" onConfirm={confirmLeave} onCancel={() => setLeaving(null)} />
    </div>
  )
}
