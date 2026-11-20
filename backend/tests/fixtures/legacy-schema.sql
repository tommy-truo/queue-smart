
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
