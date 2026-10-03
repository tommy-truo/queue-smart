import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext.ts'
import { queueEntries, services } from '../../mock/data.ts'
import type { QueueStatus as Status } from '../../types.ts'
import { waitRange } from './waitRange.ts'

const steps: { status: Status; label: string }[] = [
  { status: 'waiting', label: 'Waiting' },
  { status: 'almost-ready', label: 'Almost ready' },
  { status: 'serving', label: 'Being served' },
  { status: 'served', label: 'Served' },
]

function statusFor(peopleAhead: number, served: boolean): Status {
  if (served) return 'served'
  if (peopleAhead === 0) return 'serving'
  if (peopleAhead === 1) return 'almost-ready'
  return 'waiting'
}

export default function QueueStatus() {
  const { user } = useAuth()
  // "View as" sets a role without a signed-in user, so fall back to the mock user.
  const userId = user?.id ?? 'u1'

  const myEntry = queueEntries.find((e) => e.userId === userId)
  const service = services.find((s) => s.id === myEntry?.serviceId)
  const startAhead = myEntry
    ? queueEntries.filter((e) => e.serviceId === myEntry.serviceId).indexOf(myEntry)
    : 0

  // UI simulation: each update moves the line forward by one person.
  const [peopleAhead, setPeopleAhead] = useState(startAhead)
  const [served, setServed] = useState(false)
  const [updates, setUpdates] = useState<string[]>([])

  if (!myEntry || !service) {
    return (
      <div>
        <h1>Queue Status</h1>
        <p>
          You are not in a queue. <Link to="/join">Join one</Link>
        </p>
      </div>
    )
  }

  const status = statusFor(peopleAhead, served)
  const currentStep = steps.findIndex((s) => s.status === status)

  function simulateUpdate() {
    let message: string
    if (peopleAhead > 0) {
      const next = peopleAhead - 1
      setPeopleAhead(next)
      message =
        next === 0
          ? "It's your turn. Please head to the desk."
          : `You moved up. ${next} ${next === 1 ? 'person' : 'people'} ahead of you.`
    } else {
      setServed(true)
      message = 'You have been served. Thanks for using QueueSmart.'
    }
    setUpdates([message, ...updates])
  }

  return (
    <div>
      <h1>Queue Status</h1>
      <h2>{service.name}</h2>

      <p>
        Position: <strong>{served ? '-' : `#${peopleAhead + 1}`}</strong>
        <br />
        People ahead of you: {served ? 0 : peopleAhead}
        <br />
        Estimated wait: {served ? 'done' : waitRange(peopleAhead, service.expectedDuration)}
      </p>

      <ol>
        {steps.map((step, i) => (
          <li key={step.status} style={{ fontWeight: i === currentStep ? 'bold' : 'normal' }}>
            {step.label}
            {i === currentStep ? ' (current)' : ''}
          </li>
        ))}
      </ol>

      <button type="button" onClick={simulateUpdate} disabled={served}>
        Simulate next update
      </button>

      <h2>Updates</h2>
      {updates.length === 0 ? (
        <p>No updates yet.</p>
      ) : (
        <ul>
          {updates.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
