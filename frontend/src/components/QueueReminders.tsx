import { dismissQueueReminder, useQueues } from '../queues.ts'
import LiveWait from './LiveWait.tsx'

/** Reminders remain visible across customer pages until dismissed or the waiting period ends. */
export default function QueueReminders() {
  const { services, entries, busy, actionError, runAction } = useQueues()
  const due = entries.filter(entry => entry.status !== 'serving' && entry.reminderNotificationId && !entry.reminderDismissed)
  if (!due.length && !actionError) return null
  return <aside className="queue-reminders" aria-label="Queue reminders">
    {due.map(entry => {
      const name = services.find(service => service.id === entry.serviceId)?.name ?? 'your service'
      return <section className="reminder-banner" key={entry.reminderNotificationId}>
        <div>
          <div role="status">
            <strong>Get ready for {name}</strong>
            <p>You requested a {entry.reminderLeadMinutes ?? entry.reminderMinutes ?? 10}-minute reminder.</p>
          </div>
          <p><LiveWait entry={entry} /></p>
        </div>
        <button type="button" disabled={busy} aria-label={`Dismiss reminder for ${name}`} onClick={() => void runAction(async () => {
          await dismissQueueReminder(entry.serviceId, entry.reminderNotificationId!)
          return 'Reminder dismissed. It remains in your notification history.'
        })}>Dismiss</button>
      </section>
    })}
    {actionError ? <p role="alert">{actionError}</p> : null}
  </aside>
}
