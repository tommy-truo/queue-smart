import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, invalidateSessionRequests, SESSION_EVENT_KEY, SESSION_EXPIRED_EVENT } from '../api.ts'
import { AuthContext, type LoginResult, type RegisterInput, type RegisterResult, type SessionUser } from './AuthContext.ts'
import { validateRegister } from './validateAuth.ts'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)
  const syncGeneration = useRef(0)

  function announceSession(account: SessionUser | null) {
    syncGeneration.current += 1
    invalidateSessionRequests()
    setUser(account)
    setReady(true)
    // Store only a change signal. The authenticated identity comes from the server.
    localStorage.removeItem('queuesmart.sessionUser')
    localStorage.setItem(SESSION_EVENT_KEY, crypto.randomUUID())
  }

  useEffect(() => {
    let active = true
    async function sync(clear = false) {
      const generation = ++syncGeneration.current
      if (clear) { invalidateSessionRequests(); setUser(null); setReady(false) }
      try {
        const account = await api<SessionUser>('/auth/session')
        if (active && generation === syncGeneration.current) setUser(account)
      } catch {
        if (active && generation === syncGeneration.current) setUser(null)
      } finally {
        if (active && generation === syncGeneration.current) setReady(true)
      }
    }
    const changed = (event: StorageEvent) => { if (event.key === SESSION_EVENT_KEY || event.key === null) void sync(true) }
    const expired = () => { void sync(true) }
    localStorage.removeItem('queuesmart.sessionUser')
    void sync()
    window.addEventListener('storage', changed)
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)
    return () => { active = false; window.removeEventListener('storage', changed); window.removeEventListener(SESSION_EXPIRED_EVENT, expired) }
  }, [])

  async function login(email: string, password: string): Promise<LoginResult> {
    try {
      const account = await api<SessionUser>('/auth/login', { method: 'POST', body: { email, password } })
      announceSession(account)
      return { ok: true, role: account.role }
    } catch (err) {
      return { ok: false, message: err instanceof ApiError && err.status === 401 ? 'Email or password is incorrect.' : err instanceof Error ? err.message : 'Login failed.' }
    }
  }

  async function register(input: RegisterInput): Promise<RegisterResult> {
    const errors = validateRegister(input)
    if (Object.keys(errors).length) return { ok: false, reason: 'validation', errors }
    try {
      const { fullName, email, password } = input
      const account = await api<SessionUser>('/auth/register', { method: 'POST', body: { fullName, email, password, phone: input.phone.trim() || undefined } })
      announceSession(account)
      return { ok: true, role: account.role }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return { ok: false, reason: 'email-taken' }
      if (err instanceof ApiError && err.status === 400 && err.fields) return { ok: false, reason: 'validation', errors: err.fields }
      return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Registration failed.' }
    }
  }

  async function logout() {
    await api<void>('/auth/logout', { method: 'POST' })
    announceSession(null)
  }

  if (!ready) return <p role="status">Checking session…</p>
  return (
    <AuthContext value={{ role: user?.role ?? null, user, login, register, logout }}>
      <Fragment key={user?.id ?? 'guest'}>{children}</Fragment>
    </AuthContext>
  )
}
