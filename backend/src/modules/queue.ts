import { HttpError } from '../errors.ts'
import { db, nextId } from '../store.ts'
import type { Priority, QueueEntry, Service, User } from '../types.ts'
import { assertValid } from '../validation.ts'
import { recordHistory } from './history.ts'
import { notify } from './notifications.ts'
import { getService, PRIORITIES } from './services.ts'
import { estimateWait } from './waitTime.ts'

/** People at or above this position (1 = next up) are marked almost ready. */
export const ALMOST_READY_POSITION = 1

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

export type QueueView = QueueEntry & {
  /** 0 while being served, otherwise 1-based place in line. */
  position: number
  /** Minutes. */
  estimatedWait: number
}

function compareQueueOrder(a: QueueEntry, b: QueueEntry): number {
  if (a.status === 'serving') return -1
  if (b.status === 'serving') return 1
  if (a.sortRank !== undefined && b.sortRank !== undefined) return a.sortRank - b.sortRank
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  return byPriority !== 0 ? byPriority : a.joinedAt.localeCompare(b.joinedAt)
}

function activeEntries(serviceId: string): QueueEntry[] {
  return db.entries.filter((e) => e.serviceId === serviceId && !e.outcome)
}

function serviceUsesSortRank(serviceId: string): boolean {
  return activeEntries(serviceId).some((e) => e.sortRank !== undefined)
}

function assignSortRanksFromOrder(ordered: QueueEntry[]): void {
  for (const [index, entry] of ordered.entries()) {
    const stored = db.entries.find((e) => e.id === entry.id)!
    stored.sortRank = index
  }
}

/** Writes sortRank 0..n-1 from the current priority/arrival order when none exist yet. */
function ensureSortRanks(serviceId: string): void {
  if (serviceUsesSortRank(serviceId)) return
  const ordered = [...activeEntries(serviceId)].sort(compareQueueOrder)
  assignSortRanksFromOrder(ordered)
}

function placeJoinedEntryByPriority(serviceId: string, entry: QueueEntry, priority: Priority): void {
  const ordered = orderedEntries(serviceId).filter((e) => e.id !== entry.id)
  const serving = ordered.filter((e) => e.status === 'serving')
  const waiting = ordered.filter((e) => e.status !== 'serving')
  let insertAt = waiting.length
  for (let i = 0; i < waiting.length; i++) {
    if (PRIORITY_RANK[waiting[i].priority] > PRIORITY_RANK[priority]) {
      insertAt = i
      break
    }
  }
  assignSortRanksFromOrder([...serving, ...waiting.slice(0, insertAt), entry, ...waiting.slice(insertAt)])
}

function placeRequeuedAtPriorityGroupEnd(serviceId: string, entry: QueueEntry): void {
  const ordered = orderedEntries(serviceId)
  const serving = ordered.filter((e) => e.status === 'serving')
  const waiting = ordered.filter((e) => e.status !== 'serving' && e.id !== entry.id)
  let insertAt = waiting.length
  for (let i = waiting.length - 1; i >= 0; i--) {
    if (waiting[i].priority === entry.priority) {
      insertAt = i + 1
      break
    }
  }
  assignSortRanksFromOrder([...serving, ...waiting.slice(0, insertAt), entry, ...waiting.slice(insertAt)])
}

/** Active entries for a service: the person being served first, then sortRank or priority and arrival. */
export function orderedEntries(serviceId: string): QueueEntry[] {
  return [...activeEntries(serviceId)].sort(compareQueueOrder)
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
  for (const entry of getQueue(service.id)) {
    if (entry.status === 'serving') continue
    const stored = db.entries.find((e) => e.id === entry.id)!
    const close = entry.position <= ALMOST_READY_POSITION

    if (close && stored.status === 'waiting') {
      stored.status = 'almost-ready'
      notify(stored.userId, 'status-change', `You are almost up for ${service.name}.`)
    } else if (!close && stored.status === 'almost-ready') {
      stored.status = 'waiting'
    }
  }
}

function findActiveEntry(userId: string, serviceId: string): QueueEntry | undefined {
  return db.entries.find((e) => e.userId === userId && e.serviceId === serviceId && !e.outcome)
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
  db.entries.push(entry)
  if (serviceUsesSortRank(serviceId)) placeJoinedEntryByPriority(serviceId, entry, priority)

  const view = viewOf(entry.id, serviceId)
  notify(
    user.id,
    'queue-update',
    `You joined the queue for ${service.name}. Position ${view.position}, about ${view.estimatedWait} min.`,
  )
  updateStatuses(service)
  return viewOf(entry.id, serviceId)
}

export function leaveQueue(user: User, serviceId: string): QueueEntry {
  const service = getService(serviceId)
  const entry = findActiveEntry(user.id, serviceId)
  if (!entry) throw new HttpError(404, `You are not in line for ${service.name}.`)

  entry.outcome = 'left'
  recordHistory(user.id, service.name, 'left')
  updateStatuses(service)
  return entry
}

/** Staff take someone off the line without marking them served or calling the next person. */
export function removeFromQueue(serviceId: string, entryId: string): QueueEntry {
  const service = getService(serviceId)
  const entry = db.entries.find((e) => e.id === entryId && e.serviceId === serviceId && !e.outcome)
  if (!entry) throw new HttpError(404, `That person is not in line for ${service.name}.`)

  entry.outcome = 'removed'
  recordHistory(entry.userId, service.name, 'removed')
  notify(entry.userId, 'queue-update', `You were removed from the queue for ${service.name}.`)
  updateStatuses(service)
  return entry
}

/** Puts the person being served at the end of their priority group without calling the next person. */
export function requeue(serviceId: string): QueueView {
  const service = getService(serviceId)
  const serving = orderedEntries(serviceId).find((entry) => entry.status === 'serving')
  if (!serving) throw new HttpError(409, `No one is being served for ${service.name}.`)

  serving.status = 'waiting'
  delete serving.calledAt
  serving.joinedAt = new Date().toISOString()
  if (serviceUsesSortRank(serviceId)) placeRequeuedAtPriorityGroupEnd(serviceId, serving)
  notify(serving.userId, 'queue-update', `You were placed back in line for ${service.name}.`)
  updateStatuses(service)
  return viewOf(serving.id, serviceId)
}

/** Moves a waiting person one place up or down; may cross priority groups when sortRank is in use. */
export function reorder(serviceId: string, entryId: string, body: unknown): QueueView {
  const service = getService(serviceId)
  assertValid(body, { direction: { type: 'string', oneOf: ['up', 'down'] as const } })
  const direction = (body as { direction: 'up' | 'down' }).direction

  const entry = db.entries.find((e) => e.id === entryId && e.serviceId === serviceId && !e.outcome)
  if (!entry) throw new HttpError(404, `That person is not in line for ${service.name}.`)
  if (entry.status === 'serving') {
    throw new HttpError(409, `The person being served cannot be reordered for ${service.name}.`)
  }

  ensureSortRanks(serviceId)
  const ordered = orderedEntries(serviceId)
  const index = ordered.findIndex((e) => e.id === entryId)
  const neighborIndex = index + (direction === 'up' ? -1 : 1)

  if (neighborIndex < 0 || neighborIndex >= ordered.length) {
    throw new HttpError(409, `That person cannot move ${direction} in the queue for ${service.name}.`)
  }
  const neighbor = ordered[neighborIndex]
  if (neighbor.status === 'serving') {
    throw new HttpError(409, `That person cannot move ${direction} in the queue for ${service.name}.`)
  }

  const stored = db.entries.find((e) => e.id === entryId)!
  const storedNeighbor = db.entries.find((e) => e.id === neighbor.id)!
  const rank = stored.sortRank!
  stored.sortRank = storedNeighbor.sortRank!
  storedNeighbor.sortRank = rank

  updateStatuses(service)
  return viewOf(entryId, serviceId)
}

/** Finishes whoever is being served and calls the next person in line. */
export function serveNext(serviceId: string): { served?: QueueEntry; nowServing?: QueueEntry } {
  const service = getService(serviceId)
  const entries = orderedEntries(serviceId)
  if (entries.length === 0) throw new HttpError(409, `No one is waiting for ${service.name}.`)

  let served: QueueEntry | undefined
  if (entries[0].status === 'serving') {
    served = entries.shift()!
    served.status = 'served'
    served.outcome = 'served'
    recordHistory(served.userId, service.name, 'served')
  }

  const nowServing = entries[0]
  if (nowServing) {
    nowServing.status = 'serving'
    nowServing.calledAt = new Date().toISOString()
    notify(nowServing.userId, 'status-change', `It is your turn for ${service.name}.`)
  }

  updateStatuses(service)
  return { served, nowServing }
}

/** The user's active entries across all services. */
export function myQueues(userId: string): QueueView[] {
  const serviceIds = new Set(db.entries.filter((e) => e.userId === userId && !e.outcome).map((e) => e.serviceId))
  return [...serviceIds].flatMap((id) => getQueue(id).filter((e) => e.userId === userId))
}
