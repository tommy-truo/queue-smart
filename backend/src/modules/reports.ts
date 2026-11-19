import { getDb } from '../db.ts'
import { HttpError } from '../errors.ts'
import { getService } from './services.ts'

export type ReportFilters = {
  /** YYYY-MM-DD, inclusive. */
  from?: string
  to?: string
  serviceId?: string
}

export type ParticipationRow = {
  userName: string
  email: string
  serviceName: string
  date: string
  outcome: string
}

export type ServiceActivityRow = {
  serviceName: string
  expectedDuration: number
  priority: string
  queueStatus: string
  waitingNow: number
  served: number
  left: number
  removed: number
  /** Minutes from joining to being called, or null with no data. */
  averageWait: number | null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Reads from, to and serviceId out of a query string. */
export function parseFilters(query: Record<string, unknown>): ReportFilters {
  const filters: ReportFilters = {}
  for (const key of ['from', 'to'] as const) {
    const value = query[key]
    if (value === undefined || value === '') continue
    if (typeof value !== 'string' || !DATE.test(value)) throw new HttpError(400, `${key} must be a date like 2026-09-29.`)
    filters[key] = value
  }
  if (typeof query.serviceId === 'string' && query.serviceId) filters.serviceId = query.serviceId
  return filters
}

/** Every user's queue history, newest first. */
export function participationReport(filters: ReportFilters): ParticipationRow[] {
  const serviceName = filters.serviceId ? getService(filters.serviceId).name : null
  return getDb()
    .prepare(
      `SELECT p.fullName AS userName, p.email, h.serviceName, h.occurredOn AS date, h.outcome
       FROM History h JOIN UserProfile p ON p.userId = h.userId
       WHERE (? IS NULL OR h.occurredOn >= ?) AND (? IS NULL OR h.occurredOn <= ?) AND (? IS NULL OR h.serviceName = ?)
       ORDER BY h.occurredOn DESC, p.fullName`,
    )
    .all(filters.from ?? null, filters.from ?? null, filters.to ?? null, filters.to ?? null, serviceName, serviceName) as ParticipationRow[]
}

/** One row per service: its details, who is waiting now, outcomes, and the average actual wait. */
export function serviceActivityReport(filters: ReportFilters): ServiceActivityRow[] {
  const from = filters.from ?? null
  const to = filters.to ?? null
  const id = filters.serviceId ?? null
  if (id) getService(id)
  const rows = getDb()
    .prepare(
      `SELECT s.name AS serviceName, s.expectedDuration, s.priority, q.status AS queueStatus,
         (SELECT COUNT(*) FROM QueueEntry e WHERE e.queueId = q.queueId AND e.status = 'waiting') AS waitingNow,
         (SELECT COUNT(*) FROM History h WHERE h.serviceName = s.name AND h.outcome = 'served'
            AND (?1 IS NULL OR h.occurredOn >= ?1) AND (?2 IS NULL OR h.occurredOn <= ?2)) AS served,
         (SELECT COUNT(*) FROM History h WHERE h.serviceName = s.name AND h.outcome = 'left'
            AND (?1 IS NULL OR h.occurredOn >= ?1) AND (?2 IS NULL OR h.occurredOn <= ?2)) AS left,
         (SELECT COUNT(*) FROM History h WHERE h.serviceName = s.name AND h.outcome = 'removed'
            AND (?1 IS NULL OR h.occurredOn >= ?1) AND (?2 IS NULL OR h.occurredOn <= ?2)) AS removed,
         (SELECT AVG((julianday(e.calledAt) - julianday(e.joinedAt)) * 1440) FROM QueueEntry e
            WHERE e.queueId = q.queueId AND e.calledAt IS NOT NULL
            AND (?1 IS NULL OR substr(e.joinedAt, 1, 10) >= ?1) AND (?2 IS NULL OR substr(e.joinedAt, 1, 10) <= ?2)) AS averageWait
       FROM Service s JOIN Queue q ON q.serviceId = s.serviceId
       WHERE (?3 IS NULL OR s.serviceId = ?3)
       ORDER BY s.rowid`,
    )
    .all(from, to, id) as ServiceActivityRow[]
  return rows.map(row => ({ ...row, averageWait: row.averageWait === null ? null : Math.round(row.averageWait) }))
}

export type WaitByHourRow = {
  /** 0-23, from when people joined. */
  hour: number
  visits: number
  /** Minutes from joining to being called. */
  averageWait: number
}

/** Average actual wait for each hour of the day people joined, for hours with data. */
export function waitByHourReport(filters: ReportFilters): WaitByHourRow[] {
  if (filters.serviceId) getService(filters.serviceId)
  const rows = getDb()
    .prepare(
      `SELECT CAST(substr(e.joinedAt, 12, 2) AS INTEGER) AS hour, COUNT(*) AS visits,
         AVG((julianday(e.calledAt) - julianday(e.joinedAt)) * 1440) AS averageWait
       FROM QueueEntry e JOIN Queue q ON q.queueId = e.queueId
       WHERE e.calledAt IS NOT NULL
         AND (?1 IS NULL OR substr(e.joinedAt, 1, 10) >= ?1) AND (?2 IS NULL OR substr(e.joinedAt, 1, 10) <= ?2)
         AND (?3 IS NULL OR q.serviceId = ?3)
       GROUP BY hour ORDER BY hour`,
    )
    .all(filters.from ?? null, filters.to ?? null, filters.serviceId ?? null) as WaitByHourRow[]
  return rows.map(row => ({ ...row, averageWait: Math.round(row.averageWait) }))
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** One header row of column names, then one line per row. */
export function toCsv(rows: object[], columns: string[]): string {
  const lines = [columns.join(',')]
  for (const row of rows) {
    const record = row as Record<string, unknown>
    lines.push(columns.map(column => csvCell(record[column])).join(','))
  }
  return lines.join('\n') + '\n'
}

export const PARTICIPATION_COLUMNS = ['userName', 'email', 'serviceName', 'date', 'outcome']
export const SERVICE_ACTIVITY_COLUMNS = [
  'serviceName',
  'expectedDuration',
  'priority',
  'queueStatus',
  'waitingNow',
  'served',
  'left',
  'removed',
  'averageWait',
]
export const WAIT_BY_HOUR_COLUMNS = ['hour', 'visits', 'averageWait']
