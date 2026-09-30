import { useState, type ReactNode } from 'react'
import {
  findAccountByEmail,
  isEmailTaken,
  saveRegisteredAccount,
  toSessionUser,
  verifyCredentials,
  type RegisterInput,
  type SessionUser,
} from './accounts.ts'
import { AuthContext, homePath, type Role } from './AuthContext.ts'
import { validateRegister } from './validateAuth.ts'

const ROLE_KEY = 'queuesmart.role'
const SESSION_EMAIL_KEY = 'queuesmart.sessionEmail'

function loadRole(): Role | null {
  const stored = localStorage.getItem(ROLE_KEY)
  return stored && stored in homePath ? (stored as Role) : null
}

function loadSessionUser(role: Role | null): SessionUser | null {
  if (!role) return null
  const sessionEmail = localStorage.getItem(SESSION_EMAIL_KEY)
  if (!sessionEmail) return null
  const account = findAccountByEmail(sessionEmail)
  if (!account || account.role !== role) return null
  return toSessionUser(account)
}

function persistSession(role: Role | null, email: string | null): void {
  if (role) localStorage.setItem(ROLE_KEY, role)
  else localStorage.removeItem(ROLE_KEY)

  if (email) localStorage.setItem(SESSION_EMAIL_KEY, email)
  else localStorage.removeItem(SESSION_EMAIL_KEY)
}

// Stand-in for real authentication until the backend API exists.
// Passwords are stored in plaintext in mock data / localStorage for Assignment 2 only.
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(() => loadRole())
  const [user, setUser] = useState<SessionUser | null>(() => loadSessionUser(loadRole()))

  function startSession(account: ReturnType<typeof toSessionUser>): void {
    setRoleState(account.role)
    setUser(account)
    persistSession(account.role, account.email)
  }

  function setRole(next: Role | null) {
    setRoleState(next)
    setUser(null)
    persistSession(next, null)
  }

  function login(email: string, password: string) {
    const account = verifyCredentials(email, password)
    if (!account) return { ok: false as const }
    startSession(toSessionUser(account))
    return { ok: true as const, role: account.role }
  }

  function register(input: RegisterInput) {
    const errors = validateRegister({
      fullName: input.fullName,
      email: input.email,
      password: input.password,
      confirmPassword: input.confirmPassword,
    })
    if (Object.keys(errors).length > 0) {
      return { ok: false as const, reason: 'validation' as const, errors }
    }
    if (isEmailTaken(input.email)) {
      return { ok: false as const, reason: 'email-taken' as const }
    }
    const account = saveRegisteredAccount(input)
    startSession(toSessionUser(account))
    return { ok: true as const, role: account.role }
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
