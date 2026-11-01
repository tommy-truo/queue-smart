import { resetDatabase } from './db.ts'
import type { AppNotification, HistoryEntry } from './types.ts'

type Store = {
  notifications: AppNotification[]
  history: HistoryEntry[]
}

function seed(): Store {
  return {
    notifications: [
      { id: 'n1', userId: 'u1', type: 'queue-update', message: 'You joined the queue for Academic Advising.', createdAt: '2026-09-29T09:20:00', read: false },
      { id: 'n2', userId: 'u1', type: 'status-change', message: 'Student ID Office queue is closed for today.', createdAt: '2026-09-28T16:30:00', read: true },
    ],
    history: [
      { id: 'h1', userId: 'u1', date: '2026-09-22', serviceName: 'IT Support', outcome: 'served' },
      { id: 'h2', userId: 'u1', date: '2026-09-15', serviceName: 'Financial Aid Help Desk', outcome: 'left' },
      { id: 'h3', userId: 'u1', date: '2026-09-08', serviceName: 'Academic Advising', outcome: 'served' },
      { id: 'h4', userId: 'u1', date: '2026-09-02', serviceName: 'Student ID Office', outcome: 'removed' },
    ],
  }
}

export const db: Store = seed()

let counter = 0

export function nextId(prefix: string): string {
  counter += 1
  return `${prefix}${counter}-${Date.now().toString(36)}`
}

/** Puts the seed data back. Used by tests so each one starts fresh. */
export function resetStore(): void {
  Object.assign(db, seed())
  resetDatabase()
}
