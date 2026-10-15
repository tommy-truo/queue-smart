import type { AppNotification, HistoryEntry, QueueEntry, Service, User } from './types.ts'

type Store = {
  users: User[]
  services: Service[]
  entries: QueueEntry[]
  notifications: AppNotification[]
  history: HistoryEntry[]
}

function seed(): Store {
  return {
    users: [
      { id: 'u1', email: 'alex.kim@example.com', password: 'UserPass1', fullName: 'Alex Kim', role: 'user' },
      { id: 'u2', email: 'jordan.lee@example.com', password: 'UserPass1', fullName: 'Jordan Lee', role: 'user' },
      { id: 'u3', email: 'sam.patel@example.com', password: 'UserPass1', fullName: 'Sam Patel', role: 'user' },
      { id: 'u4', email: 'riley.chen@example.com', password: 'UserPass1', fullName: 'Riley Chen', role: 'user' },
      { id: 'u5', email: 'morgan.diaz@example.com', password: 'UserPass1', fullName: 'Morgan Diaz', role: 'user' },
      { id: 'u6', email: 'casey.wong@example.com', password: 'UserPass1', fullName: 'Casey Wong', role: 'user' },
      { id: 'a1', email: 'admin@queuesmart.local', password: 'AdminPass1', fullName: 'Admin User', role: 'admin' },
      { id: 'e1', email: 'employee@queuesmart.local', password: 'EmployeePass1', fullName: 'Employee User', role: 'employee' },
    ],
    services: [
      {
        id: 's1',
        name: 'Academic Advising',
        description: 'Walk-in advising for degree plans and course registration.',
        expectedDuration: 15,
        priority: 'high',
        open: true,
      },
      {
        id: 's2',
        name: 'Financial Aid Help Desk',
        description: 'Questions about aid packages, deadlines and paperwork.',
        expectedDuration: 10,
        priority: 'medium',
        open: true,
      },
      {
        id: 's3',
        name: 'IT Support',
        description: 'Password resets and device troubleshooting.',
        expectedDuration: 20,
        priority: 'low',
        open: true,
      },
      {
        id: 's4',
        name: 'Student ID Office',
        description: 'New and replacement student ID cards.',
        expectedDuration: 5,
        priority: 'low',
        open: false,
      },
    ],
    entries: [
      { id: 'q1', serviceId: 's1', userId: 'u2', userName: 'Jordan Lee', status: 'serving', priority: 'medium', joinedAt: '2026-09-29T09:05:00', calledAt: '2026-09-29T09:25:00' },
      { id: 'q2', serviceId: 's1', userId: 'u3', userName: 'Sam Patel', status: 'almost-ready', priority: 'medium', joinedAt: '2026-09-29T09:12:00' },
      { id: 'q3', serviceId: 's1', userId: 'u1', userName: 'Alex Kim', status: 'waiting', priority: 'medium', joinedAt: '2026-09-29T09:20:00' },
      { id: 'q4', serviceId: 's2', userId: 'u4', userName: 'Riley Chen', status: 'almost-ready', priority: 'medium', joinedAt: '2026-09-29T09:15:00' },
      { id: 'q5', serviceId: 's3', userId: 'u5', userName: 'Morgan Diaz', status: 'almost-ready', priority: 'medium', joinedAt: '2026-09-29T09:01:00' },
      { id: 'q6', serviceId: 's3', userId: 'u6', userName: 'Casey Wong', status: 'waiting', priority: 'medium', joinedAt: '2026-09-29T09:18:00' },
    ],
    notifications: [
      { id: 'n1', userId: 'u1', type: 'queue-update', message: 'You joined the queue for Academic Advising.', createdAt: '2026-09-29T09:20:00', read: false },
      { id: 'n2', userId: 'u1', type: 'status-change', message: 'Student ID Office queue is closed for today.', createdAt: '2026-09-28T16:30:00', read: true },
    ],
    history: [
      { id: 'h1', userId: 'u1', date: '2026-09-22', serviceName: 'IT Support', outcome: 'served' },
      { id: 'h2', userId: 'u1', date: '2026-09-15', serviceName: 'Financial Aid Help Desk', outcome: 'left' },
      { id: 'h3', userId: 'u1', date: '2026-09-08', serviceName: 'Academic Advising', outcome: 'served' },
      { id: 'h4', userId: 'u1', date: '2026-09-02', serviceName: 'Student ID Office', outcome: 'removed' },
    ],
  }
}

export const db: Store = seed()

let counter = 0

export function nextId(prefix: string): string {
  counter += 1
  return `${prefix}${counter}-${Date.now().toString(36)}`
}

/** Puts the seed data back. Used by tests so each one starts fresh. */
export function resetStore(): void {
  Object.assign(db, seed())
}
