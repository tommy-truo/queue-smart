import type { DatabaseSync } from 'node:sqlite'
import { hashPassword } from './password.ts'

// A year of finished visits so reports and wait estimates have real history to work with.
// Only loaded into the app's database file, never into the in-memory test database.

const FIRST_NAMES = ['Ava', 'Ben', 'Chloe', 'Diego', 'Elena', 'Faisal', 'Grace', 'Hiro', 'Isla', 'Jamal', 'Kira', 'Liam']
const LAST_NAMES = ['Nguyen', 'Garcia', 'Okafor', 'Smith']

const SERVICES = [
  { queueId: 'qu1', name: 'Academic Advising', duration: 15, priority: 'high' },
  { queueId: 'qu2', name: 'Financial Aid Help Desk', duration: 10, priority: 'medium' },
  { queueId: 'qu3', name: 'IT Support', duration: 20, priority: 'low' },
  { queueId: 'qu4', name: 'Student ID Office', duration: 5, priority: 'low' },
]

/** How busy each opening hour is, relative to an average hour. */
const HOUR_LOAD: Record<number, number> = { 9: 0.6, 10: 1.2, 11: 1.6, 12: 1.0, 13: 1.4, 14: 1.2, 15: 0.8, 16: 0.5 }

/** How busy each month is (January = 0): rushes at the start of each semester, quiet in summer. */
const MONTH_LOAD = [1.4, 1.0, 0.9, 1.0, 0.8, 0.4, 0.4, 1.5, 1.2, 1.0, 0.9, 0.6]

/** Small seeded random generator, so the demo data is the same every time. */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const stamp = (date: Date) => date.toISOString().slice(0, 19)

/** Adds demo users and one year of visits ending yesterday. */
export function seedDemoYear(target: DatabaseSync, today = new Date()): void {
  const rand = random(39)
  const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)]

  const addCredentials = target.prepare("INSERT INTO UserCredentials (userId, email, passwordHash, role) VALUES (?, ?, ?, 'user')")
  const addProfile = target.prepare('INSERT INTO UserProfile (userId, fullName, email) VALUES (?, ?, ?)')
  const addEntry = target.prepare(
    'INSERT INTO QueueEntry (entryId, queueId, userId, position, priority, joinedAt, calledAt, status) VALUES (?, ?, ?, 1, ?, ?, ?, ?)',
  )
  const addHistory = target.prepare(
    'INSERT INTO History (historyId, userId, serviceName, occurredOn, outcome) VALUES (?, ?, ?, ?, ?)',
  )

  target.exec('BEGIN')
  try {
    const userIds = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']
    const hash = hashPassword('UserPass1')
    let n = 0
    for (const first of FIRST_NAMES) {
      const last = LAST_NAMES[n % LAST_NAMES.length]
      n += 1
      const id = `d${n}`
      const email = `${first}.${last}@example.com`.toLowerCase()
      addCredentials.run(id, email, hash)
      addProfile.run(id, `${first} ${last}`, email)
      userIds.push(id)
    }

    const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    let visit = 0
    for (let daysAgo = 365; daysAgo >= 1; daysAgo -= 1) {
      const day = new Date(end - daysAgo * 86_400_000)
      const weekday = day.getUTCDay()
      if (weekday === 0 || weekday === 6) continue
      const monthLoad = MONTH_LOAD[day.getUTCMonth()]

      for (const service of SERVICES) {
        const visits = Math.floor(rand() * 5 * monthLoad)
        for (let i = 0; i < visits; i += 1) {
          visit += 1
          const hour = 9 + Math.floor(rand() * 8)
          const joined = new Date(day.getTime() + hour * 3_600_000 + Math.floor(rand() * 60) * 60_000)
          const waitMinutes = Math.round(service.duration * HOUR_LOAD[hour] * monthLoad * (0.6 + rand() * 0.8))
          const roll = rand()
          const outcome = roll < 0.1 ? 'left' : roll < 0.16 ? 'removed' : 'served'
          const called = outcome === 'served' ? stamp(new Date(joined.getTime() + waitMinutes * 60_000)) : null
          const userId = pick(userIds)

          addEntry.run(`dq${visit}`, service.queueId, userId, service.priority, stamp(joined), called, outcome === 'served' ? 'served' : 'canceled')
          addHistory.run(`dh${visit}`, userId, service.name, stamp(joined).slice(0, 10), outcome)
        }
      }
    }
    target.exec('COMMIT')
  } catch (error) {
    target.exec('ROLLBACK')
    throw error
  }
}

/**
 * The small seed has people in line and notifications from a fixed day. Shifts them so the
 * latest one happened ten minutes ago, keeping the gaps between them, so waits read as minutes not weeks.
 */
export function moveLiveSeedToNow(target: DatabaseSync, now = new Date()): void {
  const { latest } = target
    .prepare("SELECT MAX(joinedAt) AS latest FROM QueueEntry WHERE status = 'waiting'")
    .get() as { latest: string | null }
  if (!latest) return
  // Stored times are local wall-clock times with no time zone, so do the maths on wall-clock values
  // (both read as UTC) to keep a daylight saving change in between from adding or losing an hour.
  const nowWallClock = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds())
  const seconds = Math.round((nowWallClock - 10 * 60_000 - Date.parse(latest + 'Z')) / 1000)
  const shift = (column: string) => `strftime('%Y-%m-%dT%H:%M:%S', ${column}, '${seconds >= 0 ? '+' : ''}${seconds} seconds')`
  target
    .prepare(`UPDATE QueueEntry SET joinedAt = ${shift('joinedAt')}, calledAt = ${shift('calledAt')} WHERE status = 'waiting'`)
    .run()
  target.prepare(`UPDATE Notification SET createdAt = ${shift('createdAt')}`).run()
}
