import { Navigate, Outlet } from 'react-router'
import { homePath, useAuth } from './AuthContext.ts'

export default function RequireGuest() {
  const { role } = useAuth()
  if (role) return <Navigate to={homePath[role]} replace />
  return <Outlet />
}
