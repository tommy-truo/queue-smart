import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/db.ts'

describe('database schema', () => {
  it('creates all tables', () => {
    const db = openDatabase(':memory:')
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
    const names = rows.map((r) => r.name)
    for (const table of ['UserCredentials', 'UserProfile', 'Service', 'Queue', 'QueueEntry', 'Notification', 'History']) {
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

  it('enforces notification type and message length', () => {
    const db = openDatabase(':memory:')
    db.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)').run('u1', 'a@b.co', 'h', 'user')
    const insert = db.prepare(
      'INSERT INTO Notification (notificationId, userId, type, message, createdAt, status) VALUES (?, ?, ?, ?, ?, ?)',
    )
    insert.run('n1', 'u1', 'queue-update', 'hi', '2026-01-01', 'sent')
    insert.run('n2', 'u1', 'status-change', 'hello', '2026-01-01', 'viewed')
    expect(() => insert.run('n3', 'u1', 'alert', 'bad', '2026-01-01', 'sent')).toThrow()

    const msg1000 = 'x'.repeat(1000)
    insert.run('n4', 'u1', 'queue-update', msg1000, '2026-01-01', 'sent')
    const msg1001 = 'x'.repeat(1001)
    expect(() => insert.run('n5', 'u1', 'queue-update', msg1001, '2026-01-01', 'sent')).toThrow()
  })

  it('enforces history outcome and user id', () => {
    const db = openDatabase(':memory:')
    db.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)').run('u1', 'a@b.co', 'h', 'user')
    const insert = db.prepare('INSERT INTO History (historyId, userId, serviceName, occurredOn, outcome) VALUES (?, ?, ?, ?, ?)')
    insert.run('h1', 'u1', 'Help Desk', '2026-01-01', 'served')
    insert.run('h2', 'u1', 'Help Desk', '2026-01-02', 'left')
    insert.run('h3', 'u1', 'Help Desk', '2026-01-03', 'removed')
    expect(() => insert.run('h4', 'u1', 'Help Desk', '2026-01-04', 'canceled')).toThrow()
    expect(() => insert.run('h5', 'missing', 'Help Desk', '2026-01-01', 'served')).toThrow()
  })

  it('enforces service expectedDuration between 1 and 480', () => {
    const db = openDatabase(':memory:')
    const insert = db.prepare('INSERT INTO Service (serviceId, name, description, expectedDuration, priority) VALUES (?, ?, ?, ?, ?)')
    insert.run('s1', 'A', 'd', 1, 'low')
    insert.run('s2', 'B', 'd', 480, 'low')
    expect(() => insert.run('s3', 'C', 'd', 0, 'low')).toThrow()
    expect(() => insert.run('s4', 'D', 'd', 481, 'low')).toThrow()
  })

  it('keeps notifications on disk after reopening the same database file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'queuesmart-db-'))
    const file = path.join(dir, 'test-notifications.db')
    const write = openDatabase(file)
    try {
      write.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)').run('ux', 'persist@example.com', 'hash', 'user')
      write.prepare('INSERT INTO Notification (notificationId, userId, type, message, createdAt, status) VALUES (?, ?, ?, ?, ?, ?)').run(
        'n-persist',
        'ux',
        'queue-update',
        'Survives restart',
        '2026-01-02T10:00:00',
        'sent',
      )
    } finally {
      write.close()
    }

    const read = openDatabase(file)
    try {
      const row = read
        .prepare('SELECT notificationId, message, status FROM Notification WHERE notificationId = ?')
        .get('n-persist') as { notificationId: string; message: string; status: string }
      expect(row).toEqual({ notificationId: 'n-persist', message: 'Survives restart', status: 'sent' })
    } finally {
      read.close()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('keeps history on disk after reopening the same database file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'queuesmart-db-'))
    const file = path.join(dir, 'test-history.db')
    const write = openDatabase(file)
    try {
      write.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)').run('ux', 'persist@example.com', 'hash', 'user')
      write.prepare('INSERT INTO History (historyId, userId, serviceName, occurredOn, outcome) VALUES (?, ?, ?, ?, ?)').run(
        'h-persist',
        'ux',
        'IT Support',
        '2026-09-22',
        'served',
      )
    } finally {
      write.close()
    }

    const read = openDatabase(file)
    try {
      const row = read
        .prepare('SELECT historyId, serviceName, occurredOn, outcome FROM History WHERE historyId = ?')
        .get('h-persist') as { historyId: string; serviceName: string; occurredOn: string; outcome: string }
      expect(row).toEqual({ historyId: 'h-persist', serviceName: 'IT Support', occurredOn: '2026-09-22', outcome: 'served' })
    } finally {
      read.close()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
