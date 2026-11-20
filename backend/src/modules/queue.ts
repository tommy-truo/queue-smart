import { getDb } from '../db.ts'
import { transaction } from '../transaction.ts'
import { HttpError } from '../errors.ts'
import { localTimestamp, nextId } from '../util.ts'
import type { Priority, QueueEntry, Service, User } from '../types.ts'
import { assertValid } from '../validation.ts'
import { recordHistory } from './history.ts'
import { notify } from './notifications.ts'
import { getService, listServices, PRIORITIES } from './services.ts'
import { liveWait } from './waitTime.ts'
import { sendDueReminders, validateReminderMinutes } from './reminders.ts'

/** People at or above this position (1 = next up) are marked almost ready. */
export const ALMOST_READY_POSITION = 1

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

/** Append the service notification only when set (avoids the literal "undefined" in SQLite text). */
function withServiceNotification(body: string, service: Service): string {
  const extra = service.notification
  return extra ? body + ' ' + extra : body
}

export type QueueView = QueueEntry & {
  /** 0 while being served, otherwise 1-based place in line. */
  position: number
  /** Minutes. */
  estimatedWait: number
  estimatedWaitSeconds: number
  estimateUpdatedAt: number
  peopleAhead: number
  serviceDelayed: boolean
  awaitingStaff: boolean
  countdownFloorSeconds: number
}

type EntryRow = {
  entryId: string
  serviceId: string
  userId: string
  userName: string
  priority: Priority
  joinedAt: string
  calledAt: string | null
  almostReady: number
  reminderMinutes: number
  reminderSentAt: string | null
  reminderNotificationId: string | null
  reminderDismissed: number
  reminderWaitMinutes: number | null
  reminderLeadMinutes: number | null
}

// Everyone still in line, including whoever is being served. Add filters and ORDER BY after it.
const ACTIVE_ENTRIES = `
  SELECT e.entryId, q.serviceId, e.userId, p.fullName AS userName, e.priority, e.joinedAt, e.calledAt, e.almostReady,
    e.reminderMinutes, e.reminderSentAt, e.reminderNotificationId, e.reminderDismissed, e.reminderWaitMinutes, e.reminderLeadMinutes
  FROM QueueEntry e
  JOIN Queue q ON q.queueId = e.queueId
  JOIN UserProfile p ON p.userId = e.userId
  WHERE e.status = 'waiting'`

function toEntry(row: EntryRow): QueueEntry {
  const entry: QueueEntry = {
    id: row.entryId,
    serviceId: row.serviceId,
    userId: row.userId,
    userName: row.userName,
    status: row.calledAt ? 'serving' : row.almostReady ? 'almost-ready' : 'waiting',
    priority: row.priority,
    joinedAt: row.joinedAt,
    reminderMinutes: row.reminderMinutes,
    reminderSentAt: row.reminderSentAt ?? undefined,
    reminderNotificationId: row.reminderNotificationId ?? undefined,
    reminderDismissed: !!row.reminderDismissed,
    reminderWaitMinutes: row.reminderWaitMinutes ?? undefined,
    reminderLeadMinutes: row.reminderLeadMinutes ?? undefined,
  }
  if (row.calledAt) entry.calledAt = row.calledAt
  return entry
}

/** Active entries for a service: the person being served first, then in line order. */
export function orderedEntries(serviceId: string): QueueEntry[] {
  const rows = getDb().prepare(`${ACTIVE_ENTRIES} AND q.serviceId = ? ORDER BY e.position`).all(serviceId) as EntryRow[]
  return rows.map(toEntry)
}

function findActiveEntry(userId: string, serviceId: string): QueueEntry | undefined {
  const row = getDb().prepare(`${ACTIVE_ENTRIES} AND e.userId = ? AND q.serviceId = ?`).get(userId, serviceId) as
    | EntryRow
    | undefined
  return row && toEntry(row)
}

function findEntry(serviceId: string, entryId: string): QueueEntry | undefined {
  const row = getDb().prepare(`${ACTIVE_ENTRIES} AND e.entryId = ? AND q.serviceId = ?`).get(entryId, serviceId) as
    | EntryRow
    | undefined
  return row && toEntry(row)
}

/** Stores the given order as positions 1..n. */
function savePositions(entries: QueueEntry[]): void {
  const update = getDb().prepare('UPDATE QueueEntry SET position = ? WHERE entryId = ?')
  for (const [index, entry] of entries.entries()) update.run(index + 1, entry.id)
}

/** Closes the gap left by someone who is no longer in line. */
function renumber(serviceId: string): void {
  savePositions(orderedEntries(serviceId))
}

function finish(entryId: string, status: 'served' | 'canceled'): void {
  getDb().prepare('UPDATE QueueEntry SET status = ? WHERE entryId = ?').run(status, entryId)
}

/** Where someone of this priority goes in a waiting list: ahead of the first lower priority. */
function insertionIndex(waiting: QueueEntry[], priority: Priority): number {
  const lower = waiting.findIndex((e) => PRIORITY_RANK[e.priority] > PRIORITY_RANK[priority])
  return lower === -1 ? waiting.length : lower
}

export function getQueue(serviceId: string, now = Date.now()): QueueView[] {
  const service = getService(serviceId)
  const entries = orderedEntries(serviceId)
  const serving = entries[0]?.status === 'serving' ? entries[0] : undefined
  return entries.map((entry, index) => ({
    ...entry,
    position: serving ? index : index + 1,
    peopleAhead: index,
    estimateUpdatedAt: now,
    countdownFloorSeconds: Math.max(0, index - (serving ? 1 : 0)) * service.expectedDuration * 60,
    ...(entry.status === 'serving'
      ? { estimatedWait: 0, estimatedWaitSeconds: 0, serviceDelayed: false, awaitingStaff: false }
      : liveWait(index - (serving ? 1 : 0), service.expectedDuration, serving?.calledAt, now)),
  }))
}

/** Every open queue with its summary and the people in it, for the admin live board. */
export function openQueues() {
  return listServices()
    .filter((service) => service.open)
    .map((service) => ({ ...service, ...queueSummary(service), entries: getQueue(service.id) }))
}

/** Queue length and the wait someone joining now would get. */
export function queueSummary(service: Service) {
  const entries = orderedEntries(service.id)
  const serving = entries[0]?.status === 'serving' ? entries[0] : undefined
  const wait = liveWait(entries.length - (serving ? 1 : 0), service.expectedDuration, serving?.calledAt)
  return { queueLength: entries.length, estimatedWait: wait.estimatedWait }
}

/** Checks all queues even if no customer currently has the app open. */
export function processQueueReminders(now = Date.now()): number {
  return transaction(() => listServices().reduce((count, service) => count + sendDueReminders(service, getQueue(service.id, now), now), 0))
}

/** Keeps the positional badge while timed reminders replace the old front-of-line alert. */
function updateStatuses(service: Service): void {
  const setAlmostReady = getDb().prepare('UPDATE QueueEntry SET almostReady = ? WHERE entryId = ?')
  for (const entry of getQueue(service.id)) {
    if (entry.status === 'serving') continue
    const close = entry.position <= ALMOST_READY_POSITION

    if (close && entry.status === 'waiting') {
      setAlmostReady.run(1, entry.id)
    } else if (!close && entry.status === 'almost-ready') {
      setAlmostReady.run(0, entry.id)
    }
  }
  sendDueReminders(service, getQueue(service.id))
}

function viewOf(entryId: string, serviceId: string): QueueView {
  return getQueue(serviceId).find((e) => e.id === entryId)!
}

export function joinQueue(user: User, serviceId: string, body: unknown): QueueView {
  return transaction(() => {
    const service = getService(serviceId)
    assertValid(body, { priority: { type: 'string', oneOf: ['medium'] } })
    const priority: Priority = 'medium'
    const reminderMinutes = validateReminderMinutes(body, false)

    if (!service.open) throw new HttpError(409, `${service.name} is not accepting people right now.`)
    if (findActiveEntry(user.id, serviceId)) throw new HttpError(409, `You are already in line for ${service.name}.`)

    const entry: QueueEntry = {
      id: nextId('q'),
      serviceId,
      userId: user.id,
      userName: user.fullName,
      status: 'waiting',
      priority,
      joinedAt: localTimestamp(),
      reminderMinutes,
      reminderDismissed: false,
    }
    const db = getDb()
    const queue = db.prepare('SELECT queueId FROM Queue WHERE serviceId = ?').get(serviceId) as { queueId: string }
    const line = orderedEntries(serviceId)
    db.prepare(
      "INSERT INTO QueueEntry (entryId, queueId, userId, position, priority, joinedAt, reminderMinutes, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting')",
    ).run(entry.id, queue.queueId, user.id, line.length + 1, priority, entry.joinedAt, reminderMinutes)

    // Whoever is being served stays first; everyone else is ordered by priority.
    const serving = line.filter((e) => e.status === 'serving')
    const waiting = line.filter((e) => e.status !== 'serving')
    const insertAt = insertionIndex(waiting, priority)
    savePositions([...serving, ...waiting.slice(0, insertAt), entry, ...waiting.slice(insertAt)])

    const view = viewOf(entry.id, serviceId)
    const waitMessage = view.estimatedWait === 0
      ? 'Waiting for staff to call you.'
      : `Estimated wait: about ${view.estimatedWait} min.`
    const note = withServiceNotification(
      `You joined the queue for ${service.name}. Position ${view.position}. ${waitMessage}`,
      service,
    )
    notify(user.id, 'queue-update', note)
    updateStatuses(service)
    return viewOf(entry.id, serviceId)
  })
}

export function leaveQueue(user: User, serviceId: string): QueueEntry {
  return transaction(() => {
    const service = getService(serviceId)
    const entry = findActiveEntry(user.id, serviceId)
    if (!entry) throw new HttpError(404, `You are not in line for ${service.name}.`)

    finish(entry.id, 'canceled')
    recordHistory(user.id, service.name, 'left', service.id)
    renumber(serviceId)
    updateStatuses(service)
    return { ...entry, outcome: 'left' }
  })
}

/** Staff take someone off the line without marking them served or calling the next person. */
export function removeFromQueue(serviceId: string, entryId: string): QueueEntry {
  return transaction(() => {
    const service = getService(serviceId)
    const entry = findEntry(serviceId, entryId)
    if (!entry) throw new HttpError(404, `That person is not in line for ${service.name}.`)

    finish(entry.id, 'canceled')
    recordHistory(entry.userId, service.name, 'removed', service.id)
    notify(entry.userId, 'queue-update', `You were removed from the queue for ${service.name}.`)
    renumber(serviceId)
    updateStatuses(service)
    return { ...entry, outcome: 'removed' }
  })
}

/** Reject stale staff actions before any queue, history, or notification writes. */
function assertExpectedEntry(body: unknown, entry: QueueEntry): void {
  if (body === undefined) return
  assertValid(body, {
    expectedEntryId: { type: 'string', required: true, min: 1 },
    expectedStatus: { type: 'string', required: true, oneOf: ['waiting', 'almost-ready', 'serving'] },
  })
  const expected = body as { expectedEntryId: string; expectedStatus: QueueEntry['status'] }
  if (expected.expectedEntryId !== entry.id || expected.expectedStatus !== entry.status) {
    throw new HttpError(409, 'The queue changed. Refresh it before trying again.')
  }
}

/** Puts the person being served at the end of their priority group without calling the next person. */
export function requeue(serviceId: string, body?: unknown): QueueView {
  return transaction(() => {
    const service = getService(serviceId)
    const line = orderedEntries(serviceId)
    const serving = line.find((entry) => entry.status === 'serving')
    if (!serving) throw new HttpError(409, `No one is being served for ${service.name}.`)
    assertExpectedEntry(body, serving)

    getDb()
      .prepare('UPDATE QueueEntry SET calledAt = NULL, almostReady = 0, joinedAt = ?, reminderSentAt = NULL, reminderNotificationId = NULL, reminderDismissed = 0, reminderWaitMinutes = NULL, reminderLeadMinutes = NULL WHERE entryId = ?')
      .run(localTimestamp(), serving.id)

    const waiting = line.filter((e) => e !== serving)
    const lastInGroup = waiting.findLastIndex((e) => e.priority === serving.priority)
    const insertAt = lastInGroup === -1 ? insertionIndex(waiting, serving.priority) : lastInGroup + 1
    savePositions([...waiting.slice(0, insertAt), serving, ...waiting.slice(insertAt)])

    const note = withServiceNotification('You were placed back in line for ' + service.name + '.', service)
    notify(serving.userId, 'queue-update', note)
    updateStatuses(service)
    return viewOf(serving.id, serviceId)
  })
}

/** Moves a waiting person one place up or down; may cross priority groups. */
export function reorder(serviceId: string, entryId: string, body: unknown): QueueView {
  return transaction(() => {
    const service = getService(serviceId)
    assertValid(body, { direction: { type: 'string', required: true, oneOf: ['up', 'down'] as const } })
    const direction = (body as { direction: 'up' | 'down' }).direction

    const entry = findEntry(serviceId, entryId)
    if (!entry) throw new HttpError(404, `That person is not in line for ${service.name}.`)
    if (entry.status === 'serving') {
      throw new HttpError(409, `The person being served cannot be reordered for ${service.name}.`)
    }

    const line = orderedEntries(serviceId)
    const index = line.findIndex((e) => e.id === entryId)
    const neighborIndex = index + (direction === 'up' ? -1 : 1)
    const neighbor = line[neighborIndex]
    if (!neighbor || neighbor.status === 'serving') {
      throw new HttpError(409, `That person cannot move ${direction} in the queue for ${service.name}.`)
    }

    line[index] = neighbor
    line[neighborIndex] = entry
    savePositions(line)

    updateStatuses(service)
    return viewOf(entryId, serviceId)
  })
}

/** Finishes whoever is being served and calls the next person in line. */
export function serveNext(serviceId: string, body?: unknown): { served?: QueueEntry; nowServing?: QueueEntry } {
  return transaction(() => {
    const service = getService(serviceId)
    const line = orderedEntries(serviceId)
    if (line.length === 0) throw new HttpError(409, `No one is waiting for ${service.name}.`)
    assertExpectedEntry(body, line[0])

    let served: QueueEntry | undefined
    if (line[0].status === 'serving') {
      served = { ...line.shift()!, status: 'served', outcome: 'served' }
      finish(served.id, 'served')
      recordHistory(served.userId, service.name, 'served', service.id)
    }

    let nowServing: QueueEntry | undefined
    if (line[0]) {
      const calledAt = localTimestamp()
      getDb().prepare('UPDATE QueueEntry SET calledAt = ?, almostReady = 0 WHERE entryId = ?').run(calledAt, line[0].id)
      nowServing = { ...line[0], status: 'serving', calledAt }
      const note = withServiceNotification('It is your turn for ' + service.name + '.', service)
      notify(nowServing.userId, 'status-change', note)
    }

    savePositions(line)
    updateStatuses(service)
    return { served, nowServing }
  })
}

/** Staff assign priority; equal-priority customers retain their existing relative order. */
export function assignPriority(serviceId: string, entryId: string, body: unknown): QueueView {
  return transaction(() => {
    const service = getService(serviceId)
    assertValid(body, { priority: { type: 'string', required: true, oneOf: PRIORITIES } })
    const priority = (body as { priority: Priority }).priority
    const entry = findEntry(serviceId, entryId)
    if (!entry) throw new HttpError(404, `That person is not in line for ${service.name}.`)
    if (entry.priority === priority) return viewOf(entryId, serviceId)
    getDb().prepare('UPDATE QueueEntry SET priority = ? WHERE entryId = ?').run(priority, entryId)
    if (entry.status !== 'serving') {
      const others = orderedEntries(serviceId).filter(e => e.id !== entryId)
      const serving = others.filter(e => e.status === 'serving')
      const waiting = others.filter(e => e.status !== 'serving')
      const index = insertionIndex(waiting, priority)
      savePositions([...serving, ...waiting.slice(0, index), { ...entry, priority }, ...waiting.slice(index)])
    }
    updateStatuses(service)
    return viewOf(entryId, serviceId)
  })
}

/** The user's active entries across all services. */
export function myQueues(userId: string): QueueView[] {
  const rows = getDb().prepare(`${ACTIVE_ENTRIES} AND e.userId = ? ORDER BY e.rowid`).all(userId) as EntryRow[]
  const serviceIds = new Set(rows.map((row) => row.serviceId))
  return [...serviceIds].flatMap((id) => getQueue(id).filter((e) => e.userId === userId))
}

/** A customer may edit only their own active waiting entry. Editing never rearms a sent reminder. */
export function updateReminder(user: User, serviceId: string, body: unknown): QueueView {
  return transaction(() => {
    getService(serviceId)
    const minutes = validateReminderMinutes(body)
    const entry = findActiveEntry(user.id, serviceId)
    if (!entry) throw new HttpError(404, 'You are not in this queue.')
    if ((body as { entryId?: string }).entryId !== undefined && (body as { entryId: string }).entryId !== entry.id) throw new HttpError(409, 'Your queue visit changed. Refresh before changing the reminder.')
    if (entry.status === 'serving') throw new HttpError(409, 'Your turn has already started.')
    getDb().prepare('UPDATE QueueEntry SET reminderMinutes = ? WHERE entryId = ?').run(minutes, entry.id)
    sendDueReminders(getService(serviceId), getQueue(serviceId))
    return viewOf(entry.id, serviceId)
  })
}

export function dismissReminder(user: User, serviceId: string, body: unknown): QueueView {
  return transaction(() => {
    assertValid(body, { notificationId: { type: 'string', required: true, min: 1 } })
    const entry = findActiveEntry(user.id, serviceId)
    if (!entry) throw new HttpError(404, 'You are not in this queue.')
    if (entry.status === 'serving' || !entry.reminderNotificationId || entry.reminderNotificationId !== (body as { notificationId: string }).notificationId) {
      throw new HttpError(409, 'This reminder is no longer active.')
    }
    getDb().prepare('UPDATE QueueEntry SET reminderDismissed = 1 WHERE entryId = ?').run(entry.id)
    getDb().prepare("UPDATE Notification SET status = 'viewed' WHERE notificationId = ? AND userId = ?").run(entry.reminderNotificationId, user.id)
    return viewOf(entry.id, serviceId)
  })
}
