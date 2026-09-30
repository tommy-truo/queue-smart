import { NavLink, Outlet, useNavigate } from 'react-router'
import { homePath, useAuth, type Role } from '../auth/AuthContext.ts'

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
  ],
  employee: [{ to: '/employee', label: 'Queue' }],
}

export default function Layout() {
  const { role, setRole, logout } = useAuth()
  const navigate = useNavigate()

  function switchRole(next: Role | null) {
    setRole(next)
    navigate(next ? homePath[next] : '/login')
  }

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
        <label>
          View as{' '}
          <select
            value={role ?? ''}
            onChange={(e) => switchRole((e.target.value || null) as Role | null)}
          >
            <option value="">Logged out</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="employee">Employee</option>
          </select>
        </label>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
