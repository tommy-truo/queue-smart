import type { AppNotification } from '../types.ts'

export const notificationsByRole: Record<'user' | 'admin' | 'employee', AppNotification[]> = {
  user: [
    { id: 'n1', type: 'queue-update', message: 'You moved up to position 2 in Academic Advising.', createdAt: '2026-09-29T09:25:00', read: false },
    { id: 'n2', type: 'status-change', message: 'Financial Aid Help Desk is now open.', createdAt: '2026-09-29T08:00:00', read: false },
    { id: 'n3', type: 'status-change', message: 'Student ID Office queue is closed for today.', createdAt: '2026-09-28T16:30:00', read: true },
  ],
  admin: [
    { id: 'admin-n1', type: 'queue-update', message: 'Academic Advising has 2 people waiting.', createdAt: '2026-09-29T09:25:00', read: false },
    { id: 'admin-n2', type: 'status-change', message: 'Student ID Office is marked closed.', createdAt: '2026-09-29T08:00:00', read: false },
    { id: 'admin-n3', type: 'queue-update', message: 'Riley Chen is waiting in the Financial Aid Help Desk queue.', createdAt: '2026-09-28T16:30:00', read: true },
  ],
  employee: [
    { id: 'employee-n1', type: 'queue-update', message: 'Sam Patel is next in the Academic Advising queue.', createdAt: '2026-09-29T09:25:00', read: false },
    { id: 'employee-n2', type: 'queue-update', message: 'Two people are waiting in your queue.', createdAt: '2026-09-29T09:12:00', read: false },
    { id: 'employee-n3', type: 'status-change', message: 'Your queue is open and ready for service.', createdAt: '2026-09-29T08:00:00', read: true },
  ],
}
