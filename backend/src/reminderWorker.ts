import { processQueueReminders } from './modules/queue.ts'

export const REMINDER_CHECK_MS = 30_000

/** Runs on the server, independently of browser requests, and catches up after restart. */
export function startReminderWorker(check = processQueueReminders): () => void {
  const run = () => {
    try { check() }
    catch (error) { console.error('Could not check queue reminders; will retry.', error) }
  }
  run()
  const timer = setInterval(run, REMINDER_CHECK_MS)
  timer.unref()
  return () => clearInterval(timer)
}
