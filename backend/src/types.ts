export type Role = 'user' | 'admin' | 'employee'

export type Priority = 'low' | 'medium' | 'high'

export type QueueStatus = 'waiting' | 'almost-ready' | 'serving' | 'served'

export type Outcome = 'served' | 'left' | 'removed'

export type NotificationType = 'queue-update' | 'status-change'

export type User = {
  id: string
  email: string
  password: string
  fullName: string
  role: Role
}

export type PublicUser = Omit<User, 'password'>

export type Service = {
  id: string
  name: string
  description: string
  /** Minutes per person. */
  expectedDuration: number
  priority: Priority
  open: boolean
}

export type QueueEntry = {
  id: string
  serviceId: string
  userId: string
  userName: string
  status: QueueStatus
  priority: Priority
  joinedAt: string
  calledAt?: string
  outcome?: Outcome
}

export type AppNotification = {
  id: string
  userId: string
  type: NotificationType
  message: string
  createdAt: string
  read: boolean
}

export type HistoryEntry = {
  id: string
  userId: string
  date: string
  serviceName: string
  outcome: Outcome
}
