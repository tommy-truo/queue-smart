import { useEffect, useState } from 'react'
import type { Role } from '../auth/AuthContext.ts'
import type { AppNotification } from '../types.ts'
import { notificationsByRole } from '../mock/notifications.ts'
import './notifications.css'

type Filter = 'all' | 'unread'

function loadNotifications(role: Role): AppNotification[] {
  try {
    const saved = localStorage.getItem(`queuesmart-notifications-${role}`)
    const parsed: unknown = saved ? JSON.parse(saved) : []
    if (!Array.isArray(parsed)) return notificationsByRole[role]
    // Keep the current sample messages, restoring only their saved read state.
    return notificationsByRole[role].map((item) => {
      const previous = parsed.find((entry) => entry && entry.id === item.id && typeof entry.read === 'boolean')
      return previous ? { ...item, read: previous.read } : item
    })
  } catch {
    return notificationsByRole[role]
  }
}

export default function NotificationCenter({ role }: { role: Role }) {
  const [items, setItems] = useState<AppNotification[]>(() => loadNotifications(role))
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    try {
      localStorage.setItem(`queuesmart-notifications-${role}`, JSON.stringify(items))
    } catch {
      // Read controls still work when browser storage is unavailable.
    }
  }, [items, role])

  const unreadCount = items.filter((item) => !item.read).length
  const visibleItems = items.filter((item) => filter === 'all' || !item.read)

  function markRead(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item))
  }

  function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, read: true })))
  }

  return (
    <div className="notification-wrap">
      <button className="notification-bell" type="button" aria-label={`Notifications, ${unreadCount} unread`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}</span>
      </button>
      {open && <section className="notification-panel" aria-label="Notifications">
        <div className="notification-heading"><div><h2>Notifications</h2><p>{unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}</p></div><button type="button" className="text-button" onClick={markAllRead} disabled={!unreadCount}>Mark all read</button></div>
        <div className="notification-filters" role="group" aria-label="Filter notifications">
          <button type="button" className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All</button>
          <button type="button" className={filter === 'unread' ? 'selected' : ''} onClick={() => setFilter('unread')}>Unread</button>
        </div>
        <div className="notification-list">
          {visibleItems.length ? visibleItems.map((item) => <article className={`notification-item ${item.read ? 'is-read' : 'is-unread'}`} key={item.id}>
            <span className={`notification-dot ${item.type}`} aria-hidden="true" />
            <div className="notification-copy"><p>{item.message}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></div>
            {!item.read && <button type="button" className="text-button mark-read" onClick={() => markRead(item.id)} aria-label="Mark notification as read">Mark read</button>}
          </article>) : <p className="empty-notifications">No {filter} notifications.</p>}
        </div>
        <p className="notification-footnote">Updates about queues, services, and your account appear here.</p>
      </section>}
    </div>
  )
}
