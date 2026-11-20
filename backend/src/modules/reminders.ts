import { getDb } from '../db.ts'
import { HttpError } from '../errors.ts'
import { transaction } from '../transaction.ts'
import { localTimestamp } from '../util.ts'
import { assertValid } from '../validation.ts'
import type { Service } from '../types.ts'
import { notify } from './notifications.ts'

export const REMINDER_MINUTES = [5, 10, 15] as const

export function validateReminderMinutes(body: unknown, required = true): number {
  assertValid(body, { reminderMinutes: { type: 'number', integer: true, required } })
  const value = (body as { reminderMinutes?: number }).reminderMinutes ?? 10
  if (!(REMINDER_MINUTES as readonly number[]).includes(value)) {
    throw new HttpError(400, 'Invalid input', { reminderMinutes: 'Choose a reminder of 5, 10, or 15 minutes.' })
  }
  return value
}

type Candidate = {
  id: string
  userId: string
  status: string
  reminderMinutes: number
  estimatedWait: number
  estimatedWaitSeconds: number
  serviceDelayed: boolean
  awaitingStaff: boolean
}

function delayMessage(waitMinutes: number): string {
  if (waitMinutes === 0) return 'You are next. The current service is taking longer than expected.'
  return `Your estimated wait is about ${waitMinutes} minutes. Service is taking longer than expected, so the wait may change.`
}

/** The claim and notification are one transaction, including when called by a queue mutation. */
export function sendDueReminders(service: Service, entries: Candidate[], now = Date.now()): number {
  return transaction(() => {
    const db = getDb()
    let sent = 0
    for (const entry of entries) {
      if (entry.status === 'serving' || entry.estimatedWaitSeconds > entry.reminderMinutes * 60) continue
      const at = localTimestamp(new Date(now))
      const claim = db.prepare(`UPDATE QueueEntry SET reminderSentAt = ?, reminderWaitMinutes = ?, reminderLeadMinutes = reminderMinutes
        WHERE entryId = ? AND status = 'waiting' AND calledAt IS NULL AND reminderSentAt IS NULL`)
        .run(at, entry.estimatedWait, entry.id)
      if (!claim.changes) continue
      const detail = entry.awaitingStaff
        ? 'You are near the front. Waiting for staff to call the next customer.'
        : entry.serviceDelayed
          ? delayMessage(entry.estimatedWait)
          : `Your estimated wait is about ${entry.estimatedWait} minutes.`
      const note = notify(entry.userId, 'queue-update', `Get ready for ${service.name}. ${detail}${service.notification ? ` ${service.notification}` : ''}`)
      db.prepare('UPDATE QueueEntry SET reminderNotificationId = ? WHERE entryId = ?').run(note.id, entry.id)
      sent += 1
    }
    return sent
  })
}
