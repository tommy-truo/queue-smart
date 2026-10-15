import { db, nextId } from '../store.ts'
import type { HistoryEntry, Outcome } from '../types.ts'

export function recordHistory(userId: string, serviceName: string, outcome: Outcome): HistoryEntry {
  const entry: HistoryEntry = {
    id: nextId('h'),
    userId,
    date: new Date().toISOString().slice(0, 10),
    serviceName,
    outcome,
  }
  db.history.push(entry)
  return entry
}

/** Newest first. */
export function listHistory(userId: string): HistoryEntry[] {
  return db.history
    .filter((h) => h.userId === userId)
    .sort((a, b) => b.date.localeCompare(a.date))
}
