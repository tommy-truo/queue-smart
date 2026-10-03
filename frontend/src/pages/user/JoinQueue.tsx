import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext.ts'
import { queueEntries, services } from '../../mock/data.ts'
import { waitRange } from './waitRange.ts'

export default function JoinQueue() {
  const { user } = useAuth()
  // "View as" sets a role without a signed-in user, so fall back to the mock user.
  const userId = user?.id ?? 'u1'

  // UI only: joining or leaving changes local state, not the mock data.
  const [joinedId, setJoinedId] = useState(
    queueEntries.find((e) => e.userId === userId)?.serviceId ?? '',
  )
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')

  const openServices = services.filter((s) => s.open)
  const selected = services.find((s) => s.id === selectedId)
  const joined = services.find((s) => s.id === joinedId)

  // People ahead of you are everyone else already in that line.
  function peopleAhead(serviceId: string) {
    return queueEntries.filter((e) => e.serviceId === serviceId && e.userId !== userId).length
  }

  function waitFor(serviceId: string) {
    const service = services.find((s) => s.id === serviceId)
    return service ? waitRange(peopleAhead(serviceId), service.expectedDuration) : ''
  }

  function join() {
    if (!selected) return
    setJoinedId(selected.id)
    setMessage(`You joined ${selected.name}.`)
  }

  function leave() {
    if (!joined) return
    setJoinedId('')
    setMessage(`You left ${joined.name}.`)
  }

  return (
    <div className="page">
      <h1>Join Queue</h1>

      {message ? <p role="status">{message}</p> : null}

      {joined ? (
        <section>
          <h2>Your queue</h2>
          <p>
            You are in line for <strong>{joined.name}</strong> with {peopleAhead(joined.id)} ahead
            of you. Estimated wait: {waitFor(joined.id)}.
          </p>
          <button type="button" onClick={leave}>
            Leave queue
          </button>
        </section>
      ) : null}

      <section>
        <h2>Choose a service</h2>
        <label>
          Service{' '}
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">Select a service</option>
            {openServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {selected ? (
          <div>
            <p>{selected.description}</p>
            <p>
              {peopleAhead(selected.id)} ahead of you. Estimated wait: {waitFor(selected.id)}.
            </p>
            <button type="button" className="primary" onClick={join} disabled={joined !== undefined}>
              Join queue
            </button>
            {joined && joined.id !== selected.id ? (
              <p>Leave {joined.name} first to join another queue.</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
