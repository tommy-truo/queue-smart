import { createContext, useContext } from 'react'

export type Role = 'user' | 'admin' | 'employee'

export const homePath: Record<Role, string> = {
  user: '/dashboard',
  admin: '/admin',
  employee: '/employee',
}

type AuthContextValue = {
  role: Role | null
  setRole: (role: Role | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
