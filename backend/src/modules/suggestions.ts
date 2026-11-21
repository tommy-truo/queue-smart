import { getDb } from '../db.ts'
import { HttpError } from '../errors.ts'
import { getService } from './services.ts'

const TIME = /^(\d{2}):(\d{2})$/
const MINUTES_PER_DAY = 24 * 60

export type SuggestedHour = {
  /** 0-23, from when people joined. */
  hour: number
  /** Whole minutes from joining to being called. */
  averageWait: number
  visits: number
  /** Usual call clock time, HH:MM, wrapped to the same day for display. */
  calledBy: string
}

export type JoinTimeSuggestion = {
  serviceId: string
  serviceName: string
  open: boolean
  /** HH:MM when the customer needs to be called, or null when they set no deadline. */
  deadline: string | null
  hours: SuggestedHour[]
}

type HourRow = { hour: number; visits: number; averageWait: number }

/** Reads serviceId and an optional called-by time out of a query string. */
export function parseSuggestionQuery(query: Record<string, unknown>): { serviceId: string; deadline: string | null } {
  const serviceId = query.serviceId
  if (typeof serviceId !== 'string' || serviceId === '') throw new HttpError(400, 'serviceId is required.')

  const raw = query.by
  if (raw === undefined || raw === '') return { serviceId, deadline: null }
  if (typeof raw !== 'string' || !isTime(raw)) throw new HttpError(400, 'by must be a time like 15:00.')
  return { serviceId, deadline: raw }
}

function isTime(value: string): boolean {
  const match = TIME.exec(value)
  if (!match) return false
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour <= 23 && minute <= 59
}

function minutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

/** Clock time for a minute count, wrapped onto a 24-hour clock. */
function clock(totalMinutes: number): string {
  const wrapped = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hour = Math.floor(wrapped / 60)
  const minute = wrapped % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** Past join hours for one service, shortest average wait first. */
export function suggestJoinTimes(query: Record<string, unknown>): JoinTimeSuggestion {
  const { serviceId, deadline } = parseSuggestionQuery(query)
  const service = getService(serviceId)
  const deadlineMinutes = deadline === null ? null : minutes(deadline)

  const rows = getDb()
    .prepare(
      `SELECT CAST(substr(e.joinedAt, 12, 2) AS INTEGER) AS hour, COUNT(*) AS visits,
         AVG((julianday(e.calledAt) - julianday(e.joinedAt)) * 1440) AS averageWait
       FROM QueueEntry e JOIN Queue q ON q.queueId = e.queueId
       WHERE e.calledAt IS NOT NULL AND q.serviceId = ?
       GROUP BY hour`,
    )
    .all(serviceId) as HourRow[]

  const hours = rows
    .map(row => {
      const averageWait = Math.round(row.averageWait)
      const total = row.hour * 60 + averageWait
      return { hour: row.hour, averageWait, visits: row.visits, calledBy: clock(total), total }
    })
    .filter(row => deadlineMinutes === null || row.total <= deadlineMinutes)
    .sort((a, b) => a.averageWait - b.averageWait || a.hour - b.hour)
    .map(({ hour, averageWait, visits, calledBy }) => ({ hour, averageWait, visits, calledBy }))

  return { serviceId: service.id, serviceName: service.name, open: service.open, deadline, hours }
}
