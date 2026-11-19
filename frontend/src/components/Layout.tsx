import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth, type Role } from '../auth/AuthContext.ts'

type NavItem = { to: string; label: string }

const guestNav: NavItem[] = [
  { to: '/login', label: 'Login' },
  { to: '/register', label: 'Register' },
]

const navByRole: Record<Role, NavItem[]> = {
  user: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/join', label: 'Join Queue' },
    { to: '/status', label: 'Queue Status' },
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

  function handleLogout() {
    logout()
    navigate('/login')
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
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        ) : null}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
