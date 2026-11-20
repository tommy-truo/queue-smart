export type Priority = 'low' | 'medium' | 'high'

export type QueueStatus = 'waiting' | 'almost-ready' | 'serving' | 'served'

export type Outcome = 'served' | 'left' | 'removed'

export type NotificationType = 'queue-update' | 'status-change'

export type Service = {
  id: string
  name: string
  description: string
  /** Minutes per person. */
  expectedDuration: number
  priority: Priority
  notification?: string
  open: boolean
}

/** A person in a service's queue, including whoever is being served. */
export type QueueEntry = {
  id: string
  serviceId: string
  userId: string
  userName: string
  status: QueueStatus
  priority: Priority
  joinedAt: string
  /** Set when staff call the person up to be served. */
  calledAt?: string
  /** Unset while still in line; set when served, left or removed. */
  outcome?: Outcome
  reminderMinutes?: number
  reminderSentAt?: string
  reminderNotificationId?: string
  reminderDismissed?: boolean
  reminderWaitMinutes?: number
  reminderLeadMinutes?: number
}

export type AppNotification = {
  id: string
  type: NotificationType
  message: string
  createdAt: string
  read: boolean
}

export type HistoryEntry = {
  id: string
  date: string
  serviceName: string
  outcome: Outcome
}
