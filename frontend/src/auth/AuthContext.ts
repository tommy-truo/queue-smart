import { createContext, useContext } from 'react'
import type { FieldErrors } from './validateAuth.ts'

export type Role = 'user' | 'admin' | 'employee'

export type SessionUser = {
  id: string
  email: string
  fullName: string
  role: Role
}

export type RegisterInput = {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

export const homePath: Record<Role, string> = {
  user: '/dashboard',
  admin: '/admin',
  employee: '/employee',
}

export type LoginResult = { ok: true; role: Role } | { ok: false; message: string }

export type RegisterResult =
  | { ok: true; role: Role }
  | { ok: false; reason: 'validation'; errors: FieldErrors }
  | { ok: false; reason: 'email-taken' }
  | { ok: false; reason: 'error'; message: string }

type AuthContextValue = {
  role: Role | null
  user: SessionUser | null
  setRole: (role: Role | null) => void
  login: (email: string, password: string) => Promise<LoginResult>
  register: (input: RegisterInput) => Promise<RegisterResult>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
