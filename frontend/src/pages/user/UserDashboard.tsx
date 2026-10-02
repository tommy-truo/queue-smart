import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext.ts'
import { notifications, queueEntries, services } from '../../mock/data.ts'

export default function UserDashboard() {
  const { user } = useAuth()
  // "View as" sets a role without a signed-in user, so fall back to the mock user.
  const userId = user?.id ?? 'u1'

  const myEntry = queueEntries.find((e) => e.userId === userId)
  const myService = services.find((s) => s.id === myEntry?.serviceId)
  const serviceQueue = queueEntries.filter((e) => e.serviceId === myEntry?.serviceId)
  const position = myEntry ? serviceQueue.indexOf(myEntry) + 1 : 0
  const estimatedWait = myService ? (position - 1) * myService.expectedDuration : 0

  const openServices = services.filter((s) => s.open)
  const unread = notifications.filter((n) => !n.read)

  return (
    <div>
      <h1>Welcome{user ? `, ${user.fullName}` : ''}</h1>

      <section>
        <h2>Current queue</h2>
        {myEntry && myService ? (
          <p>
            You are <strong>#{position}</strong> in {myService.name} ({myEntry.status}).
            Estimated wait: about {estimatedWait} min. <Link to="/status">View status</Link>
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

      <section>
        <h2>Notifications ({unread.length} unread)</h2>
        <ul>
          {notifications.map((n) => (
            <li key={n.id} style={{ fontWeight: n.read ? 'normal' : 'bold' }}>
              {n.message} <small>{new Date(n.createdAt).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
