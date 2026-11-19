import { afterEach, describe, expect, it } from 'vitest'
import { getDb } from '../src/db.ts'
import { seedDemoYear } from '../src/demoData.ts'
import { resetStore } from '../src/store.ts'

afterEach(() => {
  resetStore()
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
    resetStore()
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
})
