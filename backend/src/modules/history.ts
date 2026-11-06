import { getDb } from '../db.ts'
import { nextId } from '../store.ts'
import type { HistoryEntry, Outcome } from '../types.ts'

type HistoryRow = {
  historyId: string
  userId: string
  serviceName: string
  occurredOn: string
  outcome: Outcome
}

function rowToHistory(row: HistoryRow): HistoryEntry {
  return {
    id: row.historyId,
    userId: row.userId,
    date: row.occurredOn,
    serviceName: row.serviceName,
    outcome: row.outcome,
  }
}

export function recordHistory(userId: string, serviceName: string, outcome: Outcome): HistoryEntry {
  const entry: HistoryEntry = {
    id: nextId('h'),
    userId,
    date: new Date().toISOString().slice(0, 10),
    serviceName,
    outcome,
  }
  getDb()
    .prepare('INSERT INTO History (historyId, userId, serviceName, occurredOn, outcome) VALUES (?, ?, ?, ?, ?)')
    .run(entry.id, entry.userId, entry.serviceName, entry.date, entry.outcome)
  return entry
}

/** Newest first. */
export function listHistory(userId: string): HistoryEntry[] {
  const rows = getDb()
    .prepare(
      'SELECT historyId, userId, serviceName, occurredOn, outcome FROM History WHERE userId = ? ORDER BY occurredOn DESC, rowid DESC',
    )
    .all(userId) as HistoryRow[]
  return rows.map(rowToHistory)
}
