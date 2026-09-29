import { Navigate, Outlet } from 'react-router'
import { homePath, useAuth, type Role } from './AuthContext.ts'

export default function RequireRole({ role: required }: { role: Role }) {
  const { role } = useAuth()
  if (role === required) return <Outlet />
  return <Navigate to={role ? homePath[role] : '/login'} replace />
}
