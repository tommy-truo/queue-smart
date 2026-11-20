import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDb, openDatabase, resetDatabase } from '../src/db.ts'
import { SCHEMA_VERSION } from '../src/migrations.ts'
import { transaction, withTransaction } from '../src/transaction.ts'

const legacySchema = fs.readFileSync(new URL('./fixtures/legacy-schema.sql', import.meta.url), 'utf8')
let directory: string
beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'queuesmart-migration-')) })
afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }) })

function legacyFile(): string {
  const file = path.join(directory, 'legacy.db')
  const db = new DatabaseSync(file)
  db.exec(legacySchema)
  db.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)').run('old', 'old@example.com', 'existing-hash', 'user')
  db.prepare('INSERT INTO UserProfile (userId, fullName, phone) VALUES (?, ?, ?)').run('old', 'Original User', '12345678901234567890')
  db.prepare('INSERT INTO Service VALUES (?, ?, ?, ?, ?, ?)').run('service-old', 'Original Service', 'Original description', 10, 'medium', null)
  db.prepare('INSERT INTO Queue VALUES (?, ?, ?, ?)').run('queue-old', 'service-old', 'open', '2026-01-01')
  db.prepare('INSERT INTO QueueEntry (entryId, queueId, userId, position, priority, joinedAt, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('entry-old', 'queue-old', 'old', 1, 'high', '2026-01-02T10:00:00', 'waiting')
  const history = db.prepare('INSERT INTO History VALUES (?, ?, ?, ?, ?)')
  history.run('matched', 'old', 'Original Service', '2026-01-01', 'served')
  history.run('unmatched', 'old', 'Unknown old name', '2026-01-01', 'left')
  db.close()
  return file
}

describe('schema migrations', () => {
  it('upgrades the actual legacy schema while preserving accounts, queues, snapshots, and legacy phone data', () => {
    const db = openDatabase(legacyFile())
    try {
      expect(db.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: SCHEMA_VERSION })
      expect(db.prepare('SELECT * FROM UserProfile').get()).toMatchObject({ email: 'old@example.com', fullName: 'Original User', phone: '12345678901234567890' })
      expect(db.prepare('SELECT passwordHash FROM UserCredentials').get()).toMatchObject({ passwordHash: 'existing-hash' })
      expect(db.prepare('SELECT entryId, priority, status FROM QueueEntry').get()).toMatchObject({ entryId: 'entry-old', priority: 'high', status: 'waiting' })
      expect(db.prepare('SELECT serviceId, serviceName FROM History WHERE historyId = ?').get('matched')).toMatchObject({ serviceId: 'service-old', serviceName: 'Original Service' })
      expect(db.prepare('SELECT serviceId FROM History WHERE historyId = ?').get('unmatched')).toMatchObject({ serviceId: null })
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
      // This is the statement that previously failed and stranded credentials during registration.
      db.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)').run('new', 'new@example.com', 'hash', 'user')
      db.prepare('INSERT INTO UserProfile (userId, fullName, email) VALUES (?, ?, ?)').run('new', 'New User', 'new@example.com')
      expect(() => db.prepare('INSERT INTO Session VALUES (?, ?, ?)').run('token-hash', 'old', Date.now() + 1000)).not.toThrow()
    } finally { db.close() }
  })

  it('upgrades the first database schema including queue fields and the longer notification limit', () => {
    const file = path.join(directory, 'initial.db')
    const initial = new DatabaseSync(file)
    initial.exec(fs.readFileSync(new URL('./fixtures/initial-schema.sql', import.meta.url), 'utf8'))
    initial.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)').run('old', 'old@example.com', 'hash', 'user')
    initial.prepare('INSERT INTO UserProfile VALUES (?, ?, ?)').run('old', 'Old User', null)
    initial.prepare('INSERT INTO Service VALUES (?, ?, ?, ?, ?, ?)').run('s', 'Help', 'Description', 5, 'low', null)
    initial.prepare('INSERT INTO Queue VALUES (?, ?, ?, ?)').run('q', 's', 'open', '2026-01-01')
    initial.prepare('INSERT INTO QueueEntry VALUES (?, ?, ?, ?, ?, ?)').run('e', 'q', 'old', 1, '2026-01-01', 'waiting')
    initial.prepare('INSERT INTO Notification VALUES (?, ?, ?, ?, ?)').run('n', 'old', 'Original message', '2026-01-01', 'sent')
    initial.close()
    const upgraded = openDatabase(file)
    try {
      expect(upgraded.prepare('SELECT priority, calledAt, almostReady FROM QueueEntry').get()).toMatchObject({ priority: 'medium', calledAt: null, almostReady: 0 })
      expect(upgraded.prepare('SELECT type, message FROM Notification').get()).toMatchObject({ type: 'queue-update', message: 'Original message' })
      expect(() => upgraded.prepare('UPDATE Notification SET message = ?').run('x'.repeat(1000))).not.toThrow()
      expect(upgraded.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally { upgraded.close() }
  })

  it('is idempotent and does not later relink unmatched historical names to newly created services', () => {
    const file = legacyFile()
    const first = openDatabase(file)
    first.prepare('INSERT INTO Service VALUES (?, ?, ?, ?, ?, ?)').run('new-service', 'Unknown old name', 'New', 5, 'low', null)
    first.close()
    const second = openDatabase(file)
    try {
      expect(second.prepare('SELECT COUNT(*) AS count FROM History').get()).toMatchObject({ count: 2 })
      expect(second.prepare('SELECT serviceId FROM History WHERE historyId = ?').get('unmatched')).toMatchObject({ serviceId: null })
    } finally { second.close() }
  })

  it('rolls back schema changes if a legacy profile cannot be backfilled, allowing repair and retry', () => {
    const file = legacyFile()
    const broken = new DatabaseSync(file)
    broken.exec('PRAGMA foreign_keys = OFF')
    broken.prepare('INSERT INTO UserProfile (userId, fullName) VALUES (?, ?)').run('orphan', 'Orphan')
    broken.close()
    expect(() => openDatabase(file)).toThrow()
    const inspect = new DatabaseSync(file)
    expect(inspect.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 0 })
    expect(inspect.prepare('PRAGMA table_info(UserProfile)').all().map(row => row.name)).not.toContain('email')
    expect(inspect.prepare('SELECT COUNT(*) AS count FROM UserCredentials').get()).toMatchObject({ count: 1 })
    inspect.prepare('DELETE FROM UserProfile WHERE userId = ?').run('orphan')
    inspect.close()
    const repaired = openDatabase(file)
    expect(repaired.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: SCHEMA_VERSION })
    repaired.close()
  })

  it('refuses newer database versions without changing data', () => {
    const file = legacyFile()
    const raw = new DatabaseSync(file)
    raw.exec('PRAGMA user_version = 999')
    raw.close()
    expect(() => openDatabase(file)).toThrow(/newer QueueSmart/)
  })

  it('keeps history snapshots after deleting a service and rejects nonexistent service references', () => {
    const db = openDatabase(legacyFile())
    try {
      expect(() => db.prepare('UPDATE History SET serviceId = ? WHERE historyId = ?').run('missing', 'matched')).toThrow()
      db.prepare('DELETE FROM Service WHERE serviceId = ?').run('service-old')
      expect(db.prepare('SELECT serviceId, serviceName FROM History WHERE historyId = ?').get('matched')).toMatchObject({ serviceId: null, serviceName: 'Original Service' })
    } finally { db.close() }
  })
})

describe('atomic mutations', () => {
  beforeEach(resetDatabase)

  it('rolls back outer failures even when a nested operation already succeeded', () => {
    const db = getDb()
    expect(() => transaction(() => {
      db.prepare('UPDATE Service SET name = ? WHERE serviceId = ?').run('Temporary', 's1')
      transaction(() => db.prepare('UPDATE Service SET name = ? WHERE serviceId = ?').run('Nested temporary', 's2'))
      throw new Error('failure')
    })).toThrow('failure')
    expect(db.prepare('SELECT name FROM Service WHERE serviceId = ?').get('s1')).toMatchObject({ name: 'Academic Advising' })
    expect(db.prepare('SELECT name FROM Service WHERE serviceId = ?').get('s2')).toMatchObject({ name: 'Financial Aid Help Desk' })
  })

  it('can roll back a nested failure and continue the outer transaction', () => {
    const db = getDb()
    transaction(() => {
      db.prepare('UPDATE Service SET description = ? WHERE serviceId = ?').run('Retained', 's1')
      try {
        withTransaction(db, () => {
          db.prepare('UPDATE Service SET name = ? WHERE serviceId = ?').run('Discarded', 's1')
          throw new Error('nested failure')
        })
      } catch { /* The enclosing operation deliberately recovers. */ }
    })
    expect(db.prepare('SELECT name, description FROM Service WHERE serviceId = ?').get('s1')).toMatchObject({ name: 'Academic Advising', description: 'Retained' })
  })

  it('restores original records when resetting and reseeding fails midway', () => {
    const db = getDb()
    db.prepare('UPDATE Service SET description = ? WHERE serviceId = ?').run('Preserve me', 's1')
    db.exec("CREATE TRIGGER FailReseed BEFORE INSERT ON UserProfile BEGIN SELECT RAISE(ABORT, 'seed failed'); END")
    try {
      expect(() => resetDatabase()).toThrow('seed failed')
      expect(db.prepare('SELECT description FROM Service WHERE serviceId = ?').get('s1')).toMatchObject({ description: 'Preserve me' })
      expect(db.prepare('SELECT COUNT(*) AS count FROM UserCredentials').get()).toMatchObject({ count: 8 })
      expect(db.prepare('SELECT COUNT(*) AS count FROM History WHERE serviceId IS NOT NULL').get()).toMatchObject({ count: 9 })
    } finally { db.exec('DROP TRIGGER FailReseed') }
  })
})
