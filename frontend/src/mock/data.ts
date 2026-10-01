import type { AppNotification, HistoryEntry, QueueEntry, Service } from '../types.ts'

export const services: Service[] = [
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
]

export const queueEntries: QueueEntry[] = [
  { id: 'e1', serviceId: 's1', userId: 'u2', userName: 'Jordan Lee', status: 'serving', joinedAt: '2026-09-29T09:05:00' },
  { id: 'e2', serviceId: 's1', userId: 'u3', userName: 'Sam Patel', status: 'almost-ready', joinedAt: '2026-09-29T09:12:00' },
  { id: 'e3', serviceId: 's1', userId: 'u1', userName: 'Alex Kim', status: 'waiting', joinedAt: '2026-09-29T09:20:00' },
  { id: 'e4', serviceId: 's2', userId: 'u4', userName: 'Riley Chen', status: 'waiting', joinedAt: '2026-09-29T09:15:00' },
  { id: 'e5', serviceId: 's3', userId: 'u5', userName: 'Morgan Diaz', status: 'waiting', joinedAt: '2026-09-29T09:01:00' },
  { id: 'e6', serviceId: 's3', userId: 'u6', userName: 'Casey Wong', status: 'waiting', joinedAt: '2026-09-29T09:18:00' },
]

export const notifications: AppNotification[] = [
  {
    id: 'n1',
    type: 'queue-update',
    message: 'You moved up to position 2 in Academic Advising.',
    createdAt: '2026-09-29T09:25:00',
    read: false,
  },
  {
    id: 'n2',
    type: 'status-change',
    message: 'Financial Aid Help Desk is now open.',
    createdAt: '2026-09-29T08:00:00',
    read: false,
  },
  {
    id: 'n3',
    type: 'status-change',
    message: 'Student ID Office queue is closed for today.',
    createdAt: '2026-09-28T16:30:00',
    read: true,
  },
]

export const history: HistoryEntry[] = [
  { id: 'h1', date: '2026-09-22', serviceName: 'IT Support', outcome: 'served' },
  { id: 'h2', date: '2026-09-15', serviceName: 'Financial Aid Help Desk', outcome: 'left' },
  { id: 'h3', date: '2026-09-08', serviceName: 'Academic Advising', outcome: 'served' },
  { id: 'h4', date: '2026-09-02', serviceName: 'Student ID Office', outcome: 'removed' },
]
