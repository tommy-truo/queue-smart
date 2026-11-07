import { DatabaseSync } from 'node:sqlite'
import { hashPassword } from './password.ts'
import type { Role } from './types.ts'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS UserCredentials (
  userId       TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE CHECK (length(email) <= 254),
  passwordHash TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('user', 'admin', 'employee'))
);

CREATE TABLE IF NOT EXISTS UserProfile (
  userId   TEXT PRIMARY KEY REFERENCES UserCredentials(userId) ON DELETE CASCADE,
  fullName TEXT NOT NULL CHECK (length(fullName) BETWEEN 1 AND 50),
  email    TEXT NOT NULL UNIQUE CHECK (length(email) <= 254),
  phone    TEXT CHECK (phone IS NULL OR length(phone) BETWEEN 10 AND 17)
);


CREATE TABLE IF NOT EXISTS Service (
  serviceId        TEXT PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 100),
  description      TEXT NOT NULL CHECK (length(description) <= 500),
  expectedDuration INTEGER NOT NULL CHECK (expectedDuration BETWEEN 1 AND 480),
  priority         TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  notification     TEXT CHECK (notification IS NULL OR length(notification) <= 500)
);

-- One queue per service. A closed queue stops new people from joining.
CREATE TABLE IF NOT EXISTS Queue (
  queueId   TEXT PRIMARY KEY,
  serviceId TEXT NOT NULL UNIQUE REFERENCES Service(serviceId) ON DELETE CASCADE,
  status    TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  createdAt TEXT NOT NULL
);

-- 'waiting' means still in line. calledAt is set while the person is being served,
-- and almostReady marks the next person up (so they are only notified once).
-- position is the place among people still in line, with 1 first.
CREATE TABLE IF NOT EXISTS QueueEntry (
  entryId     TEXT PRIMARY KEY,
  queueId     TEXT NOT NULL REFERENCES Queue(queueId) ON DELETE CASCADE,
  userId      TEXT NOT NULL REFERENCES UserCredentials(userId) ON DELETE CASCADE,
  position    INTEGER NOT NULL CHECK (position > 0),
  priority    TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  joinedAt    TEXT NOT NULL,
  calledAt    TEXT,
  almostReady INTEGER NOT NULL DEFAULT 0 CHECK (almostReady IN (0, 1)),
  status      TEXT NOT NULL CHECK (status IN ('waiting', 'served', 'canceled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS OneActiveEntry ON QueueEntry (queueId, userId) WHERE status = 'waiting';

CREATE TABLE IF NOT EXISTS Notification (
  notificationId TEXT PRIMARY KEY,
  userId         TEXT NOT NULL REFERENCES UserCredentials(userId) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('queue-update', 'status-change')),
  -- Up to 1000 chars so a queue sentence and a 500-character service notification fit together.
  message        TEXT NOT NULL CHECK (length(message) <= 1000),
  createdAt      TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('sent', 'viewed'))
);

CREATE TABLE IF NOT EXISTS History (
  historyId   TEXT PRIMARY KEY,
  userId      TEXT NOT NULL REFERENCES UserCredentials(userId) ON DELETE CASCADE,
  serviceName TEXT NOT NULL,
  occurredOn  TEXT NOT NULL,
  outcome     TEXT NOT NULL CHECK (outcome IN ('served', 'left', 'removed'))
);
`

export function openDatabase(file = process.env.DB_FILE ?? 'queuesmart.db'): DatabaseSync {
  const database = new DatabaseSync(file)
  database.exec('PRAGMA foreign_keys = ON')
  database.exec(SCHEMA)
  return database
}

let database: DatabaseSync | undefined

export function getDb(): DatabaseSync {
  if (!database) {
    database = openDatabase()
    if (!database.prepare('SELECT 1 FROM UserCredentials LIMIT 1').get()) seedAll(database)
  }
  return database
}

const SEED_USERS: { id: string; email: string; password: string; fullName: string; role: Role; phone?: string }[] = [
  { id: 'u1', email: 'alex.kim@example.com', password: 'UserPass1', fullName: 'Alex Kim', role: 'user' },
  { id: 'u2', email: 'jordan.lee@example.com', password: 'UserPass1', fullName: 'Jordan Lee', role: 'user', phone: '713-555-0142' },
  { id: 'u3', email: 'sam.patel@example.com', password: 'UserPass1', fullName: 'Sam Patel', role: 'user', phone: '281-555-0178' },
  { id: 'u4', email: 'riley.chen@example.com', password: 'UserPass1', fullName: 'Riley Chen', role: 'user' },
  { id: 'u5', email: 'morgan.diaz@example.com', password: 'UserPass1', fullName: 'Morgan Diaz', role: 'user' },
  { id: 'u6', email: 'casey.wong@example.com', password: 'UserPass1', fullName: 'Casey Wong', role: 'user' },
  { id: 'a1', email: 'admin@queuesmart.local', password: 'AdminPass1', fullName: 'Admin User', role: 'admin' },
  { id: 'e1', email: 'employee@queuesmart.local', password: 'EmployeePass1', fullName: 'Employee User', role: 'employee' },
]

// Hashing is slow on purpose, so hash each distinct seed password once.
const seedHashes = new Map<string, string>()

function seedUsers(target: DatabaseSync): void {
  const addCredentials = target.prepare('INSERT INTO UserCredentials (userId, email, passwordHash, role) VALUES (?, ?, ?, ?)')
  const addProfile = target.prepare('INSERT INTO UserProfile (userId, fullName, email, phone) VALUES (?, ?, ?, ?)')
  for (const user of SEED_USERS) {
    if (!seedHashes.has(user.password)) seedHashes.set(user.password, hashPassword(user.password))
    addCredentials.run(user.id, user.email, seedHashes.get(user.password)!, user.role)
    addProfile.run(user.id, user.fullName, user.email, user.phone ?? null)
  }
}

const SEED_SERVICES = [
  {
    id: 's1',
    queueId: 'qu1',
    name: 'Academic Advising',
    description: 'Walk-in advising for degree plans and course registration.',
    expectedDuration: 15,
    priority: 'high',
    notification: 'Please bring your student ID.',
    queueStatus: 'open',
  },
  {
    id: 's2',
    queueId: 'qu2',
    name: 'Financial Aid Help Desk',
    description: 'Questions about aid packages, deadlines and paperwork.',
    expectedDuration: 10,
    priority: 'medium',
    notification: 'Please bring your student ID.',
    queueStatus: 'open',
  },
  {
    id: 's3',
    queueId: 'qu3',
    name: 'IT Support',
    description: 'Password resets and device troubleshooting.',
    expectedDuration: 20,
    priority: 'low',
    notification: null,
    queueStatus: 'open',
  },
  {
    id: 's4',
    queueId: 'qu4',
    name: 'Student ID Office',
    description: 'New and replacement student ID cards.',
    expectedDuration: 5,
    priority: 'low',
    notification: 'Please double check that your photo for the id has been approved. Replacement IDs will cost $10.',
    queueStatus: 'closed',
  },
]

function seedServices(target: DatabaseSync): void {
  const addService = target.prepare(
    'INSERT INTO Service (serviceId, name, description, expectedDuration, priority, notification) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const addQueue = target.prepare('INSERT INTO Queue (queueId, serviceId, status, createdAt) VALUES (?, ?, ?, ?)')
  for (const s of SEED_SERVICES) {
    addService.run(s.id, s.name, s.description, s.expectedDuration, s.priority, s.notification)
    addQueue.run(s.queueId, s.id, s.queueStatus, '2026-09-29T08:00:00')
  }
}

const SEED_ENTRIES = [
  { id: 'q1', queueId: 'qu1', userId: 'u2', position: 1, joinedAt: '2026-09-29T09:05:00', calledAt: '2026-09-29T09:25:00', almostReady: 0 },
  { id: 'q2', queueId: 'qu1', userId: 'u3', position: 2, joinedAt: '2026-09-29T09:12:00', calledAt: null, almostReady: 1 },
  { id: 'q3', queueId: 'qu1', userId: 'u1', position: 3, joinedAt: '2026-09-29T09:20:00', calledAt: null, almostReady: 0 },
  { id: 'q4', queueId: 'qu2', userId: 'u4', position: 1, joinedAt: '2026-09-29T09:15:00', calledAt: null, almostReady: 1 },
  { id: 'q5', queueId: 'qu3', userId: 'u5', position: 1, joinedAt: '2026-09-29T09:01:00', calledAt: null, almostReady: 1 },
  { id: 'q6', queueId: 'qu3', userId: 'u6', position: 2, joinedAt: '2026-09-29T09:18:00', calledAt: null, almostReady: 0 },
]

function seedEntries(target: DatabaseSync): void {
  const add = target.prepare(
    "INSERT INTO QueueEntry (entryId, queueId, userId, position, priority, joinedAt, calledAt, almostReady, status) VALUES (?, ?, ?, ?, 'medium', ?, ?, ?, 'waiting')",
  )
  for (const e of SEED_ENTRIES) add.run(e.id, e.queueId, e.userId, e.position, e.joinedAt, e.calledAt, e.almostReady)
}

const SEED_NOTIFICATIONS = [
  {
    id: 'n1',
    userId: 'u1',
    type: 'queue-update' as const,
    message: 'You joined the queue for Academic Advising.',
    createdAt: '2026-09-29T09:20:00',
    status: 'sent' as const,
  },
  {
    id: 'n2',
    userId: 'u1',
    type: 'status-change' as const,
    message: 'Student ID Office queue is closed for today.',
    createdAt: '2026-09-28T16:30:00',
    status: 'viewed' as const,
  },
  {
    id: 'n3',
    userId: 'u6',
    type: 'queue-update' as const,
    message: 'You joined the queue for IT Support.',
    createdAt: '2026-09-29T09:18:00',
    status: 'sent' as const,
  },
  {
    id: 'n4',
    userId: 'u3',
    type: 'queue-update' as const,
    message: 'You are almost ready in the queue for Academic Advising.',
    createdAt: '2026-09-29T09:25:00',
    status: 'sent' as const,
  },
  {
    id: 'n5',
    userId: 'u4',
    type: 'queue-update' as const,
    message: 'You joined the queue for Financial Aid Help Desk.',
    createdAt: '2026-09-29T09:15:00',
    status: 'viewed' as const,
  },
]

function seedNotifications(target: DatabaseSync): void {
  const add = target.prepare(
    'INSERT INTO Notification (notificationId, userId, type, message, createdAt, status) VALUES (?, ?, ?, ?, ?, ?)',
  )
  for (const n of SEED_NOTIFICATIONS) {
    add.run(n.id, n.userId, n.type, n.message, n.createdAt, n.status)
  }
}

const SEED_HISTORY = [
  { id: 'h1', userId: 'u1', occurredOn: '2026-09-22', serviceName: 'IT Support', outcome: 'served' as const },
  { id: 'h2', userId: 'u1', occurredOn: '2026-09-15', serviceName: 'Financial Aid Help Desk', outcome: 'left' as const },
  { id: 'h3', userId: 'u1', occurredOn: '2026-09-08', serviceName: 'Academic Advising', outcome: 'served' as const },
  { id: 'h4', userId: 'u1', occurredOn: '2026-09-02', serviceName: 'Student ID Office', outcome: 'removed' as const },
  { id: 'h5', userId: 'u6', occurredOn: '2026-09-24', serviceName: 'Academic Advising', outcome: 'served' as const },
  { id: 'h6', userId: 'u6', occurredOn: '2026-09-10', serviceName: 'IT Support', outcome: 'left' as const },
  { id: 'h7', userId: 'u3', occurredOn: '2026-09-18', serviceName: 'Financial Aid Help Desk', outcome: 'served' as const },
  { id: 'h8', userId: 'u3', occurredOn: '2026-09-21', serviceName: 'Student ID Office', outcome: 'served' as const },
  { id: 'h9', userId: 'u5', occurredOn: '2026-09-16', serviceName: 'IT Support', outcome: 'removed' as const },
]

function seedHistory(target: DatabaseSync): void {
  const add = target.prepare(
    'INSERT INTO History (historyId, userId, serviceName, occurredOn, outcome) VALUES (?, ?, ?, ?, ?)',
  )
  for (const h of SEED_HISTORY) {
    add.run(h.id, h.userId, h.serviceName, h.occurredOn, h.outcome)
  }
}

function seedAll(target: DatabaseSync): void {
  seedUsers(target)
  seedNotifications(target)
  seedHistory(target)
  seedServices(target)
  seedEntries(target)
}

/** Empties the user and service tables (which clears queues and entries) and puts the seed data back. Used by tests. */
export function resetDatabase(): void {
  const target = getDb()
  target.exec('DELETE FROM UserCredentials')
  target.exec('DELETE FROM Service')
  seedAll(target)
}
