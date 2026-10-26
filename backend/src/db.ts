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
  phone    TEXT CHECK (phone IS NULL OR length(phone) <= 20)
);

CREATE TABLE IF NOT EXISTS Service (
  serviceId        TEXT PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 100),
  description      TEXT NOT NULL CHECK (length(description) <= 500),
  expectedDuration INTEGER NOT NULL CHECK (expectedDuration > 0),
  priority         TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  notification     TEXT CHECK (notification IS NULL OR length(notification) <= 500)
);

CREATE TABLE IF NOT EXISTS Queue (
  queueId   TEXT PRIMARY KEY,
  serviceId TEXT NOT NULL REFERENCES Service(serviceId) ON DELETE CASCADE,
  status    TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS QueueEntry (
  entryId  TEXT PRIMARY KEY,
  queueId  TEXT NOT NULL REFERENCES Queue(queueId) ON DELETE CASCADE,
  userId   TEXT NOT NULL REFERENCES UserCredentials(userId) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  joinedAt TEXT NOT NULL,
  status   TEXT NOT NULL CHECK (status IN ('waiting', 'served', 'canceled'))
);

CREATE TABLE IF NOT EXISTS Notification (
  notificationId TEXT PRIMARY KEY,
  userId         TEXT NOT NULL REFERENCES UserCredentials(userId) ON DELETE CASCADE,
  message        TEXT NOT NULL CHECK (length(message) <= 500),
  createdAt      TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('sent', 'viewed'))
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
  database ??= openDatabase()
  if (!database.prepare('SELECT 1 FROM UserCredentials LIMIT 1').get()) seedUsers(database)
  return database
}

const SEED_USERS: { id: string; email: string; password: string; fullName: string; role: Role }[] = [
  { id: 'u1', email: 'alex.kim@example.com', password: 'UserPass1', fullName: 'Alex Kim', role: 'user' },
  { id: 'u2', email: 'jordan.lee@example.com', password: 'UserPass1', fullName: 'Jordan Lee', role: 'user' },
  { id: 'u3', email: 'sam.patel@example.com', password: 'UserPass1', fullName: 'Sam Patel', role: 'user' },
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
  const addProfile = target.prepare('INSERT INTO UserProfile (userId, fullName) VALUES (?, ?)')
  for (const user of SEED_USERS) {
    if (!seedHashes.has(user.password)) seedHashes.set(user.password, hashPassword(user.password))
    addCredentials.run(user.id, user.email, seedHashes.get(user.password)!, user.role)
    addProfile.run(user.id, user.fullName)
  }
}

/** Empties the user tables and puts the seed users back. Used by tests. */
export function resetDatabase(): void {
  const target = getDb()
  target.exec('DELETE FROM UserCredentials')
  seedUsers(target)
}
