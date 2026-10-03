import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext.ts'
import { queueEntries, services } from '../../mock/data.ts'
import { waitRange } from './waitRange.ts'

export default function UserDashboard() {
  const { user } = useAuth()
  // "View as" sets a role without a signed-in user, so fall back to the mock user.
  const userId = user?.id ?? 'u1'

  const myEntry = queueEntries.find((e) => e.userId === userId)
  const myService = services.find((s) => s.id === myEntry?.serviceId)
  const serviceQueue = queueEntries.filter((e) => e.serviceId === myEntry?.serviceId)
  const position = myEntry ? serviceQueue.indexOf(myEntry) + 1 : 0
  const peopleAhead = Math.max(0, position - 1)

  const openServices = services.filter((s) => s.open)

  return (
    <div>
      <h1>Welcome{user ? `, ${user.fullName}` : ''}</h1>

      <section>
        <h2>Current queue</h2>
        {myEntry && myService ? (
          <p>
            You are <strong>#{position}</strong> in {myService.name} ({myEntry.status}), with{' '}
            {peopleAhead} {peopleAhead === 1 ? 'person' : 'people'} ahead of you. Estimated wait:{' '}
            {waitRange(peopleAhead, myService.expectedDuration)}.{' '}
            <Link to="/status">View status</Link>
          </p>
        ) : (
          <p>
            You are not in a queue. <Link to="/join">Join one</Link>
          </p>
        )}
      </section>

      <section>
        <h2>Open services</h2>
        <ul>
          {openServices.map((s) => (
            <li key={s.id}>
              {s.name}: {queueEntries.filter((e) => e.serviceId === s.id).length} in line,
              ~{s.expectedDuration} min each
            </li>
          ))}
        </ul>
      </section>

    </div>
  )
}
