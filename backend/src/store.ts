import { resetDatabase } from './db.ts'
import type { HistoryEntry } from './types.ts'

type Store = {
  history: HistoryEntry[]
}

function seed(): Store {
  return {
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
