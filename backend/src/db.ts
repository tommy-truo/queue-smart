import { DatabaseSync } from 'node:sqlite'

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
