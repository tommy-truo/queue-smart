import { useEffect, useState } from 'react'
import { api } from '../../api.ts'
import { joinQueue, leaveQueue, useQueues } from '../../queues.ts'
import type { Service } from '../../types.ts'
import ConfirmModal from '../../components/ConfirmModal.tsx'

const SHOWN_HOURS = 3

type SuggestedHour = {
  hour: number
  averageWait: number
  visits: number
  calledBy: string
}

type Suggestion = {
  serviceId: string
  serviceName: string
  open: boolean
  deadline: string | null
  hours: SuggestedHour[]
}

/** "9:10 AM" from an HH:MM clock time. */
function formatClock(value: string): string {
  const [hourText, minute] = value.split(':')
  const hour = Number(hourText)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minute} ${suffix}`
}

function formatHour(hour: number): string {
  return formatClock(`${String(hour).padStart(2, '0')}:00`)
}

export default function JoinQueue() {
  const [serviceId, setServiceId] = useState('')
  const [by, setBy] = useState('')
  const [showTimes, setShowTimes] = useState(false)
  const [leaving, setLeaving] = useState<Service | null>(null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [suggestionError, setSuggestionError] = useState('')
  const { services, entries, loading, error, busy, message, actionError, refresh, runAction } = useQueues()
  const selected = services.find(service => service.id === serviceId)
  const entry = entries.find(entry => entry.serviceId === serviceId)

  function chooseService(id: string) {
    setServiceId(id)
    setBy('')
    setShowTimes(false)
  }

  useEffect(() => {
    if (!serviceId || !showTimes) {
      setSuggestion(null)
      setSuggestionError('')
      setSuggestionLoading(false)
      return
    }
    let active = true
    setSuggestionLoading(true)
    const params = new URLSearchParams({ serviceId })
    if (by) params.set('by', by)
    api<Suggestion>(`/suggestions?${params}`)
      .then(data => { if (active) { setSuggestion(data); setSuggestionError('') } })
      .catch(err => {
        if (active) {
          setSuggestion(null)
          setSuggestionError(err instanceof Error ? err.message : 'Could not load suggested times.')
        }
      })
      .finally(() => { if (active) setSuggestionLoading(false) })
    return () => { active = false }
  }, [serviceId, by, showTimes])

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
      {message ? <p role="status">{message}</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
      {services.length === 0 ? <p>No services available.</p> : <p>Choose a service to see its current wait and join the line.</p>}
      <label className="field">
        Service
        <select value={serviceId} disabled={busy} onChange={event => chooseService(event.target.value)}>
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
              <p>Position: {entry.position === 0 ? 'Being served' : entry.position}. Estimated wait: {entry.estimatedWait} min.</p>
              <button type="button" disabled={busy} onClick={() => setLeaving(selected)}>Leave</button>
              <span className="note">You are already in this queue.</span>
            </>
          ) : (
            <>
              <p>Estimated wait: {selected.open ? `${selected.estimatedWait} min` : 'Closed'}</p>
              <button type="button" className="primary" disabled={busy || !selected.open} onClick={() => void runAction(async () => {
                await joinQueue(selected.id)
                return `You joined ${selected.name}.`
              })}>Join</button>
              {!selected.open ? <span className="note">This queue is closed right now.</span> : null}
            </>
          )}
          <p>
            <button type="button" aria-expanded={showTimes} onClick={() => setShowTimes(open => !open)}>
              {showTimes ? 'Hide best times to join' : 'Find best time to join'}
            </button>
          </p>
          {showTimes ? (
            <SuggestedHours
              by={by}
              loading={suggestionLoading}
              error={suggestionError}
              suggestion={suggestion?.serviceId === serviceId ? suggestion : null}
              onBy={setBy}
            />
          ) : null}
        </div>
      ) : null}
      <ConfirmModal open={leaving !== null} title="Leave queue?" message={`Leave the queue for ${leaving?.name}?`}
        confirmLabel="Leave" onConfirm={confirmLeave} onCancel={() => setLeaving(null)} />
    </div>
  )
}

function SuggestedHours({ by, loading, error, suggestion, onBy }: {
  by: string
  loading: boolean
  error: string
  suggestion: Suggestion | null
  onBy: (value: string) => void
}) {
  const hours = suggestion?.hours.slice(0, SHOWN_HOURS) ?? []
  return (
    <>
      <p>Usual best times to join for a minimal wait.</p>
      <label className="field">
        Called by
        <input type="time" value={by} onChange={event => onBy(event.target.value)} />
      </label>
      {loading ? <p role="status" className="loading">Loading suggested times…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && suggestion && hours.length === 0 ? (
        <p>
          {suggestion.deadline
            ? `No usual join time would get you called by ${formatClock(suggestion.deadline)}.`
            : 'No past visits for this service yet.'}
        </p>
      ) : null}
      {!loading && hours.length > 0 ? (
        <ul>
          {hours.map(hour => (
            <li key={hour.hour}>
              {formatHour(hour.hour)}: {hour.averageWait} min typical wait, usually called by {formatClock(hour.calledBy)}.
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
