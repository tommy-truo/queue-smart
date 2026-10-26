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

  it('rejects invalid roles and orphan rows', () => {
    const db = openDatabase(':memory:')
    expect(() => db.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)').run('u1', 'a@b.co', 'h', 'boss')).toThrow()
    expect(() => db.prepare('INSERT INTO Queue VALUES (?, ?, ?, ?)').run('q1', 'missing', 'open', 'now')).toThrow()
  })
})
