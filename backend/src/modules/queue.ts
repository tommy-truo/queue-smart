import { getDb } from '../db.ts'
import { HttpError } from '../errors.ts'
import { nextId } from '../store.ts'
import type { Priority, QueueEntry, Service, User } from '../types.ts'
import { assertValid } from '../validation.ts'
import { recordHistory } from './history.ts'
import { notify } from './notifications.ts'
import { getService, PRIORITIES } from './services.ts'
import { estimateWait } from './waitTime.ts'

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
}

// Everyone still in line, including whoever is being served. Add filters and ORDER BY after it.
const ACTIVE_ENTRIES = `
  SELECT e.entryId, q.serviceId, e.userId, p.fullName AS userName, e.priority, e.joinedAt, e.calledAt, e.almostReady
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

export function getQueue(serviceId: string): QueueView[] {
  const service = getService(serviceId)
  const entries = orderedEntries(serviceId)
  const someoneServing = entries[0]?.status === 'serving'

  return entries.map((entry, index) => ({
    ...entry,
    position: someoneServing ? index : index + 1,
    estimatedWait: estimateWait(index, service.expectedDuration),
  }))
}

/** Queue length and the wait someone joining now would get. */
export function queueSummary(service: Service) {
  const length = orderedEntries(service.id).length
  return { queueLength: length, estimatedWait: estimateWait(length, service.expectedDuration) }
}

/** Marks people near the front as almost ready and notifies them once. */
function updateStatuses(service: Service): void {
  const setAlmostReady = getDb().prepare('UPDATE QueueEntry SET almostReady = ? WHERE entryId = ?')
  for (const entry of getQueue(service.id)) {
    if (entry.status === 'serving') continue
    const close = entry.position <= ALMOST_READY_POSITION

    if (close && entry.status === 'waiting') {
      setAlmostReady.run(1, entry.id)
      const note = withServiceNotification('You are almost up for ' + service.name + '.', service)
      notify(entry.userId, 'status-change', note)
    } else if (!close && entry.status === 'almost-ready') {
      setAlmostReady.run(0, entry.id)
    }
  }
}

function viewOf(entryId: string, serviceId: string): QueueView {
  return getQueue(serviceId).find((e) => e.id === entryId)!
}

export function joinQueue(user: User, serviceId: string, body: unknown): QueueView {
  const service = getService(serviceId)
  assertValid(body, { priority: { type: 'string', oneOf: PRIORITIES } })
  const priority = (body as { priority?: Priority } | undefined)?.priority ?? 'medium'

  if (!service.open) throw new HttpError(409, `${service.name} is not accepting people right now.`)
  if (findActiveEntry(user.id, serviceId)) throw new HttpError(409, `You are already in line for ${service.name}.`)

  const entry: QueueEntry = {
    id: nextId('q'),
    serviceId,
    userId: user.id,
    userName: user.fullName,
    status: 'waiting',
    priority,
    joinedAt: new Date().toISOString(),
  }
  const db = getDb()
  const queue = db.prepare('SELECT queueId FROM Queue WHERE serviceId = ?').get(serviceId) as { queueId: string }
  const line = orderedEntries(serviceId)
  db.prepare(
    "INSERT INTO QueueEntry (entryId, queueId, userId, position, priority, joinedAt, status) VALUES (?, ?, ?, ?, ?, ?, 'waiting')",
  ).run(entry.id, queue.queueId, user.id, line.length + 1, priority, entry.joinedAt)

  // Whoever is being served stays first; everyone else is ordered by priority.
  const serving = line.filter((e) => e.status === 'serving')
  const waiting = line.filter((e) => e.status !== 'serving')
  const insertAt = insertionIndex(waiting, priority)
  savePositions([...serving, ...waiting.slice(0, insertAt), entry, ...waiting.slice(insertAt)])

  const view = viewOf(entry.id, serviceId)
  const note = withServiceNotification(
    'You joined the queue for ' + service.name + '. Position ' + view.position + ', about ' + view.estimatedWait + 'min.',
    service,
  )
  notify(user.id, 'queue-update', note)
  updateStatuses(service)
  return viewOf(entry.id, serviceId)
}

export function leaveQueue(user: User, serviceId: string): QueueEntry {
  const service = getService(serviceId)
  const entry = findActiveEntry(user.id, serviceId)
  if (!entry) throw new HttpError(404, `You are not in line for ${service.name}.`)

  finish(entry.id, 'canceled')
  recordHistory(user.id, service.name, 'left')
  renumber(serviceId)
  updateStatuses(service)
  return { ...entry, outcome: 'left' }
}

/** Staff take someone off the line without marking them served or calling the next person. */
export function removeFromQueue(serviceId: string, entryId: string): QueueEntry {
  const service = getService(serviceId)
  const entry = findEntry(serviceId, entryId)
  if (!entry) throw new HttpError(404, `That person is not in line for ${service.name}.`)

  finish(entry.id, 'canceled')
  recordHistory(entry.userId, service.name, 'removed')
  notify(entry.userId, 'queue-update', `You were removed from the queue for ${service.name}.`)
  renumber(serviceId)
  updateStatuses(service)
  return { ...entry, outcome: 'removed' }
}

/** Puts the person being served at the end of their priority group without calling the next person. */
export function requeue(serviceId: string): QueueView {
  const service = getService(serviceId)
  const line = orderedEntries(serviceId)
  const serving = line.find((entry) => entry.status === 'serving')
  if (!serving) throw new HttpError(409, `No one is being served for ${service.name}.`)

  getDb()
    .prepare('UPDATE QueueEntry SET calledAt = NULL, almostReady = 0, joinedAt = ? WHERE entryId = ?')
    .run(new Date().toISOString(), serving.id)

  const waiting = line.filter((e) => e !== serving)
  const lastInGroup = waiting.findLastIndex((e) => e.priority === serving.priority)
  const insertAt = lastInGroup === -1 ? insertionIndex(waiting, serving.priority) : lastInGroup + 1
  savePositions([...waiting.slice(0, insertAt), serving, ...waiting.slice(insertAt)])

  const note = withServiceNotification('You were placed back in line for ' + service.name + '.', service)
  notify(serving.userId, 'queue-update', note)
  updateStatuses(service)
  return viewOf(serving.id, serviceId)
}

/** Moves a waiting person one place up or down; may cross priority groups. */
export function reorder(serviceId: string, entryId: string, body: unknown): QueueView {
  const service = getService(serviceId)
  assertValid(body, { direction: { type: 'string', oneOf: ['up', 'down'] as const } })
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
}

/** Finishes whoever is being served and calls the next person in line. */
export function serveNext(serviceId: string): { served?: QueueEntry; nowServing?: QueueEntry } {
  const service = getService(serviceId)
  const line = orderedEntries(serviceId)
  if (line.length === 0) throw new HttpError(409, `No one is waiting for ${service.name}.`)

  let served: QueueEntry | undefined
  if (line[0].status === 'serving') {
    served = { ...line.shift()!, status: 'served', outcome: 'served' }
    finish(served.id, 'served')
    recordHistory(served.userId, service.name, 'served')
  }

  let nowServing: QueueEntry | undefined
  if (line[0]) {
    const calledAt = new Date().toISOString()
    getDb().prepare('UPDATE QueueEntry SET calledAt = ?, almostReady = 0 WHERE entryId = ?').run(calledAt, line[0].id)
    nowServing = { ...line[0], status: 'serving', calledAt }
    const note = withServiceNotification('It is your turn for ' + service.name + '.', service)
    notify(nowServing.userId, 'status-change', note)
  }

  savePositions(line)
  updateStatuses(service)
  return { served, nowServing }
}

/** The user's active entries across all services. */
export function myQueues(userId: string): QueueView[] {
  const rows = getDb().prepare(`${ACTIVE_ENTRIES} AND e.userId = ? ORDER BY e.rowid`).all(userId) as EntryRow[]
  const serviceIds = new Set(rows.map((row) => row.serviceId))
  return [...serviceIds].flatMap((id) => getQueue(id).filter((e) => e.userId === userId))
}
