import { getDb } from '../db.ts'
import { nextId } from '../store.ts'
import type { AppNotification, NotificationType } from '../types.ts'

type NotificationRow = {
  notificationId: string
  userId: string
  type: NotificationType
  message: string
  createdAt: string
  status: 'sent' | 'viewed'
}

function rowToAppNotification(row: NotificationRow): AppNotification {
  return {
    id: row.notificationId,
    userId: row.userId,
    type: row.type,
    message: row.message,
    createdAt: row.createdAt,
    read: row.status === 'viewed',
  }
}

export function notify(userId: string, type: NotificationType, message: string): AppNotification {
  const notification: AppNotification = {
    id: nextId('n'),
    userId,
    type,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  }
  getDb()
    .prepare('INSERT INTO Notification (notificationId, userId, type, message, createdAt, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(notification.id, notification.userId, notification.type, notification.message, notification.createdAt, 'sent')
  console.log(`[notify] ${userId}: ${message}`)
  return notification
}

/** Newest first. */
export function listNotifications(userId: string): AppNotification[] {
  const rows = getDb()
    .prepare(
      `SELECT notificationId, userId, type, message, createdAt, status FROM Notification WHERE userId = ? ORDER BY createdAt DESC, rowid DESC`,
    )
    .all(userId) as NotificationRow[]
  return rows.map(rowToAppNotification)
}
