import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth, type Role } from '../auth/AuthContext.ts'

type NavItem = { to: string; label: string }

const guestNav: NavItem[] = [
  { to: '/login', label: 'Log in' },
  { to: '/register', label: 'Register' },
]

const navByRole: Record<Role, NavItem[]> = {
  user: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/join', label: 'Join queue' },
    { to: '/status', label: 'Queue status' },
    { to: '/history', label: 'History' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/services', label: 'Services' },
    { to: '/admin/queue', label: 'Queues' },
    { to: '/admin/reports', label: 'Reports' },
  ],
  employee: [{ to: '/employee', label: 'Queue' }],
}

export default function Layout() {
  const { role, logout } = useAuth()
  const navigate = useNavigate()

  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError('')
    try { await logout(); navigate('/login') }
    catch (error) { setLogoutError(error instanceof Error ? error.message : 'Could not log out.') }
    finally { setLoggingOut(false) }
  }

  return (
    <>
      <header className="app-header">
        <strong>QueueSmart</strong>
        <nav>
          {(role ? navByRole[role] : guestNav).map((item) => (
            <NavLink key={item.to} to={item.to} end>
              {item.label}
            </NavLink>
          ))}
        </nav>
        {role ? (
          <button type="button" disabled={loggingOut} onClick={() => void handleLogout()}>
            Log out
          </button>
        ) : null}
      </header>
      <main>
        {logoutError && <p role="alert">{logoutError}</p>}
        <Outlet />
      </main>
    </>
  )
}
