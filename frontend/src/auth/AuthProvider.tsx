import { useState, type ReactNode } from 'react'
import { api, ApiError, SESSION_USER_KEY } from '../api.ts'
import {
  AuthContext,
  homePath,
  type LoginResult,
  type RegisterInput,
  type RegisterResult,
  type Role,
  type SessionUser,
} from './AuthContext.ts'
import { validateRegister } from './validateAuth.ts'

const ROLE_KEY = 'queuesmart.role'

function loadRole(): Role | null {
  const stored = localStorage.getItem(ROLE_KEY)
  return stored && stored in homePath ? (stored as Role) : null
}

function loadSessionUser(role: Role | null): SessionUser | null {
  if (!role) return null
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY)
    const user = raw ? (JSON.parse(raw) as SessionUser) : null
    return user && user.role === role ? user : null
  } catch {
    return null
  }
}

function persistSession(role: Role | null, user: SessionUser | null): void {
  if (role) localStorage.setItem(ROLE_KEY, role)
  else localStorage.removeItem(ROLE_KEY)

  if (user) localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(SESSION_USER_KEY)
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(() => loadRole())
  const [user, setUser] = useState<SessionUser | null>(() => loadSessionUser(loadRole()))

  function startSession(account: SessionUser): void {
    setRoleState(account.role)
    setUser(account)
    persistSession(account.role, account)
  }

  function setRole(next: Role | null) {
    setRoleState(next)
    setUser(null)
    persistSession(next, null)
  }

  async function login(email: string, password: string): Promise<LoginResult> {
    try {
      const account = await api<SessionUser>('/auth/login', { method: 'POST', body: { email, password } })
      startSession(account)
      return { ok: true, role: account.role }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        return { ok: false, message: 'Email or password is incorrect.' }
      }
      return { ok: false, message: err instanceof Error ? err.message : 'Login failed.' }
    }
  }

  async function register(input: RegisterInput): Promise<RegisterResult> {
    const errors = validateRegister(input)
    if (Object.keys(errors).length > 0) {
      return { ok: false, reason: 'validation', errors }
    }
    try {
      const { fullName, email, password } = input
      const account = await api<SessionUser>('/auth/register', {
        method: 'POST',
        body: { fullName, email, password },
      })
      startSession(account)
      return { ok: true, role: account.role }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return { ok: false, reason: 'email-taken' }
      if (err instanceof ApiError && err.status === 400 && err.fields) {
        return { ok: false, reason: 'validation', errors: err.fields }
      }
      return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Registration failed.' }
    }
  }

  function logout() {
    setRole(null)
  }

  return (
    <AuthContext
      value={{
        role,
        user,
        setRole,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext>
  )
}
