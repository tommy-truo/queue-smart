import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/db.ts'

describe('database schema', () => {
  it('creates all tables', () => {
    const db = openDatabase(':memory:')
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
    const names = rows.map((r) => r.name)
    for (const table of ['UserCredentials', 'UserProfile', 'Service', 'Queue', 'QueueEntry', 'Notification']) {
      expect(names).toContain(table)
    }
  })

  it('enforces unique emails', () => {
    const db = openDatabase(':memory:')
    const insert = db.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)')
    insert.run('u1', 'a@b.co', 'hash', 'user')
    expect(() => insert.run('u2', 'a@b.co', 'hash', 'user')).toThrow()
  })

  it('allows one queue per service and one active entry per person', () => {
    const db = openDatabase(':memory:')
    db.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)').run('u1', 'a@b.co', 'h', 'user')
    db.prepare('INSERT INTO Service (serviceId, name, description, expectedDuration, priority) VALUES (?, ?, ?, ?, ?)').run('s1', 'Help', 'Desc', 5, 'low')
    const addQueue = db.prepare('INSERT INTO Queue VALUES (?, ?, ?, ?)')
    addQueue.run('qu1', 's1', 'open', 'now')
    expect(() => addQueue.run('qu2', 's1', 'open', 'now')).toThrow()

    const addEntry = db.prepare('INSERT INTO QueueEntry (entryId, queueId, userId, position, priority, joinedAt, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    addEntry.run('e1', 'qu1', 'u1', 1, 'low', 'now', 'waiting')
    expect(() => addEntry.run('e2', 'qu1', 'u1', 2, 'low', 'now', 'waiting')).toThrow()
    expect(() => addEntry.run('e3', 'qu1', 'u1', 0, 'low', 'now', 'canceled')).toThrow()
    expect(() => addEntry.run('e4', 'qu1', 'u1', 2, 'low', 'now', 'serving')).toThrow()
    addEntry.run('e5', 'qu1', 'u1', 2, 'low', 'now', 'canceled')
  })

  it('rejects invalid roles and orphan rows', () => {
    const db = openDatabase(':memory:')
    expect(() => db.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)').run('u1', 'a@b.co', 'h', 'boss')).toThrow()
    expect(() => db.prepare('INSERT INTO Queue VALUES (?, ?, ?, ?)').run('q1', 'missing', 'open', 'now')).toThrow()
  })
})
