import { db, nextId } from '../store.ts'
import type { AppNotification, NotificationType } from '../types.ts'

export function notify(userId: string, type: NotificationType, message: string): AppNotification {
  const notification: AppNotification = {
    id: nextId('n'),
    userId,
    type,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  }
  db.notifications.push(notification)
  console.log(`[notify] ${userId}: ${message}`)
  return notification
}

/** Newest first. */
export function listNotifications(userId: string): AppNotification[] {
  return db.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
