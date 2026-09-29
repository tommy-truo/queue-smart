export type Priority = 'low' | 'medium' | 'high'

export type QueueStatus = 'waiting' | 'almost-ready' | 'served'

export type Outcome = 'served' | 'left' | 'removed'

export type NotificationType = 'queue-update' | 'status-change'

export type Service = {
  id: string
  name: string
  description: string
  /** Minutes per person. */
  expectedDuration: number
  priority: Priority
  open: boolean
}

/** A person waiting in a service's queue. Position is the index within that service's entries. */
export type QueueEntry = {
  id: string
  serviceId: string
  userId: string
  userName: string
  status: QueueStatus
  joinedAt: string
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
