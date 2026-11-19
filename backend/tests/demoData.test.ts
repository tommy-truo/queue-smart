import { afterEach, describe, expect, it } from 'vitest'
import { getDb, resetDatabase } from '../src/db.ts'
import { moveLiveSeedToNow, seedDemoYear } from '../src/demoData.ts'

afterEach(() => {
  resetDatabase()
})

const count = (sql: string) => (getDb().prepare(sql).get() as { n: number }).n

describe('demo year', () => {
  it('adds a year of weekday visits with matching history', () => {
    seedDemoYear(getDb(), new Date('2026-11-19T12:00:00Z'))

    const entries = count("SELECT COUNT(*) AS n FROM QueueEntry WHERE entryId LIKE 'dq%'")
    expect(entries).toBeGreaterThan(1000)
    expect(count("SELECT COUNT(*) AS n FROM History WHERE historyId LIKE 'dh%'")).toBe(entries)

    // Served visits have a call time, others do not, and nothing is left waiting.
    expect(count("SELECT COUNT(*) AS n FROM QueueEntry WHERE entryId LIKE 'dq%' AND (status = 'served') != (calledAt IS NOT NULL)")).toBe(0)
    expect(count("SELECT COUNT(*) AS n FROM QueueEntry WHERE entryId LIKE 'dq%' AND status = 'waiting'")).toBe(0)

    // Weekdays only, within the year before the given day.
    const range = getDb()
      .prepare("SELECT MIN(occurredOn) AS first, MAX(occurredOn) AS last FROM History WHERE historyId LIKE 'dh%'")
      .get() as { first: string; last: string }
    expect(range.first >= '2025-11-19').toBe(true)
    expect(range.last <= '2026-11-18').toBe(true)
    expect(count("SELECT COUNT(*) AS n FROM History WHERE historyId LIKE 'dh%' AND strftime('%w', occurredOn) IN ('0', '6')")).toBe(0)
  })

  it('gives the same data every time', () => {
    const snapshot = () =>
      getDb().prepare("SELECT entryId, userId, joinedAt, calledAt FROM QueueEntry WHERE entryId LIKE 'dq%' ORDER BY entryId").all()
    seedDemoYear(getDb(), new Date('2026-11-19T12:00:00Z'))
    const first = snapshot()
    resetDatabase()
    seedDemoYear(getDb(), new Date('2026-11-19T12:00:00Z'))
    expect(snapshot()).toEqual(first)
  })

  it('rolls back if something fails part way', () => {
    seedDemoYear(getDb(), new Date('2026-11-19T12:00:00Z'))
    // Second run hits duplicate users, so nothing new should be added.
    const before = count('SELECT COUNT(*) AS n FROM QueueEntry')
    expect(() => seedDemoYear(getDb(), new Date('2026-11-19T12:00:00Z'))).toThrow()
    expect(count('SELECT COUNT(*) AS n FROM QueueEntry')).toBe(before)
  })

  it('moves people in line and notifications to now, keeping the gaps', () => {
    // Seed: latest join is 2026-09-29T09:20:00, so with "now" at 15:00 on Nov 19 it lands at 14:50.
    moveLiveSeedToNow(getDb(), new Date('2026-11-19T15:00:00'))
    const times = getDb()
      .prepare("SELECT entryId, joinedAt, calledAt FROM QueueEntry WHERE entryId IN ('q1', 'q3') ORDER BY entryId")
      .all()
    expect(times).toEqual([
      { entryId: 'q1', joinedAt: '2026-11-19T14:35:00', calledAt: '2026-11-19T14:55:00' },
      { entryId: 'q3', joinedAt: '2026-11-19T14:50:00', calledAt: null },
    ])
    expect(getDb().prepare("SELECT createdAt FROM Notification WHERE notificationId = 'n2'").get()).toEqual({
      createdAt: '2026-11-18T22:00:00',
    })
  })

  it('does nothing with no one in line', () => {
    getDb().exec("UPDATE QueueEntry SET status = 'served'")
    moveLiveSeedToNow(getDb())
    expect(getDb().prepare("SELECT joinedAt FROM QueueEntry WHERE entryId = 'q1'").get()).toEqual({ joinedAt: '2026-09-29T09:05:00' })
  })
})
