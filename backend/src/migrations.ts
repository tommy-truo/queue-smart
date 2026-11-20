import type { DatabaseSync } from 'node:sqlite'

export const SCHEMA_VERSION = 4

function hasColumn(database: DatabaseSync, table: string, name: string): boolean {
  return (database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some(column => column.name === name)
}

/** Called within the schema transaction. Never drops customer or queue records. */
export function migrateDatabase(database: DatabaseSync): void {
  const version = (database.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
  if (version > SCHEMA_VERSION) throw new Error('This database was created by a newer QueueSmart version.')

  if (version < 1) {
    // ALTER preserves legacy phone values and the original table's constraints.
    if (!hasColumn(database, 'UserProfile', 'email')) {
      database.exec("ALTER TABLE UserProfile ADD COLUMN email TEXT NOT NULL DEFAULT '' CHECK (length(email) <= 254)")
      database.exec('UPDATE UserProfile SET email = (SELECT email FROM UserCredentials WHERE UserCredentials.userId = UserProfile.userId)')
    }
    database.exec('CREATE UNIQUE INDEX IF NOT EXISTS UserProfileEmail ON UserProfile(email)')
    if (!hasColumn(database, 'QueueEntry', 'priority')) {
      database.exec("ALTER TABLE QueueEntry ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'))")
    }
    if (!hasColumn(database, 'QueueEntry', 'calledAt')) database.exec('ALTER TABLE QueueEntry ADD COLUMN calledAt TEXT')
    if (!hasColumn(database, 'QueueEntry', 'almostReady')) {
      database.exec('ALTER TABLE QueueEntry ADD COLUMN almostReady INTEGER NOT NULL DEFAULT 0 CHECK (almostReady IN (0, 1))')
    }
    if (!hasColumn(database, 'Notification', 'type')) {
      database.exec("ALTER TABLE Notification ADD COLUMN type TEXT NOT NULL DEFAULT 'queue-update' CHECK (type IN ('queue-update', 'status-change'))")
    }
    const notificationSql = (database.prepare("SELECT sql FROM sqlite_master WHERE name = 'Notification'").get() as { sql: string }).sql
    if (/length\s*\(message\)\s*<=\s*500/i.test(notificationSql)) {
      database.exec(`CREATE TABLE NotificationUpgrade (
        notificationId TEXT PRIMARY KEY,
        userId TEXT NOT NULL REFERENCES UserCredentials(userId) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('queue-update', 'status-change')),
        message TEXT NOT NULL CHECK (length(message) <= 1000),
        createdAt TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('sent', 'viewed'))
      );
      INSERT INTO NotificationUpgrade SELECT notificationId, userId, type, message, createdAt, status FROM Notification;
      DROP TABLE Notification;
      ALTER TABLE NotificationUpgrade RENAME TO Notification;`)
    }
  }
  if (version < 2) {
    if (!hasColumn(database, 'History', 'serviceId')) {
      database.exec('ALTER TABLE History ADD COLUMN serviceId TEXT REFERENCES Service(serviceId) ON DELETE SET NULL')
    }
    // A snapshot with no exact unique match remains unlinked: do not guess a renamed service.
    database.exec(`UPDATE History SET serviceId = (SELECT MIN(s.serviceId) FROM Service s WHERE s.name = History.serviceName)
      WHERE serviceId IS NULL AND (SELECT COUNT(*) FROM Service s WHERE s.name = History.serviceName) = 1`)
    database.exec('CREATE INDEX IF NOT EXISTS HistoryService ON History(serviceId, occurredOn)')
  }
  if (version < 3) {
    database.exec(`CREATE TABLE IF NOT EXISTS Session (
      tokenHash TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES UserCredentials(userId) ON DELETE CASCADE,
      expiresAt INTEGER NOT NULL
    ); CREATE INDEX IF NOT EXISTS SessionUser ON Session(userId);`)
  }
  if (version < 4) {
    database.exec(`ALTER TABLE QueueEntry ADD COLUMN reminderMinutes INTEGER NOT NULL DEFAULT 10 CHECK (reminderMinutes IN (5, 10, 15));
      ALTER TABLE QueueEntry ADD COLUMN reminderSentAt TEXT;
      ALTER TABLE QueueEntry ADD COLUMN reminderNotificationId TEXT REFERENCES Notification(notificationId) ON DELETE SET NULL;
      ALTER TABLE QueueEntry ADD COLUMN reminderDismissed INTEGER NOT NULL DEFAULT 0 CHECK (reminderDismissed IN (0, 1));
      ALTER TABLE QueueEntry ADD COLUMN reminderWaitMinutes INTEGER;
      ALTER TABLE QueueEntry ADD COLUMN reminderLeadMinutes INTEGER;`)
  }
  database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}
