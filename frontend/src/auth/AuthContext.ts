import { createContext, useContext } from 'react'
import type { RegisterInput, SessionUser } from './accounts.ts'
import type { FieldErrors } from './validateAuth.ts'

export type Role = 'user' | 'admin' | 'employee'

export const homePath: Record<Role, string> = {
  user: '/dashboard',
  admin: '/admin',
  employee: '/employee',
}

export type LoginResult = { ok: true; role: Role } | { ok: false }

export type RegisterResult =
  | { ok: true; role: Role }
  | { ok: false; reason: 'validation'; errors: FieldErrors }
  | { ok: false; reason: 'email-taken' }

type AuthContextValue = {
  role: Role | null
  user: SessionUser | null
  setRole: (role: Role | null) => void
  login: (email: string, password: string) => LoginResult
  register: (input: RegisterInput) => RegisterResult
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
