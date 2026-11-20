import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import AuthProvider from '../src/auth/AuthProvider.tsx'
import { useAuth } from '../src/auth/AuthContext.ts'
import { api, invalidateSessionRequests, SESSION_EVENT_KEY } from '../src/api.ts'

const admin = { id: 'a1', fullName: 'Admin User', email: 'admin@example.com', role: 'admin' }
const employee = { id: 'e1', fullName: 'Employee User', email: 'employee@example.com', role: 'employee' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function SessionView() {
  const { user, logout } = useAuth()
  return <><p>{user ? `${user.role}:${user.id}` : 'guest'}</p><input aria-label="Private draft" defaultValue="" /><button onClick={() => void logout()}>Logout</button></>
}
beforeEach(() => { localStorage.clear(); invalidateSessionRequests() })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('authenticated frontend sessions', () => {
  it('loads identity from the server rather than trusting saved local identity', async () => {
    localStorage.setItem('queuesmart.sessionUser', JSON.stringify(admin))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'Sign in required.' }, 401)))
    render(<AuthProvider><SessionView /></AuthProvider>)
    await screen.findByText('guest')
    expect(localStorage.getItem('queuesmart.sessionUser')).toBeNull()
  })

  it('synchronizes another tab and clears account-scoped state', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(admin)).mockResolvedValueOnce(json(employee))
    vi.stubGlobal('fetch', fetch)
    render(<AuthProvider><SessionView /></AuthProvider>)
    await screen.findByText('admin:a1')
    fireEvent.change(screen.getByLabelText('Private draft'), { target: { value: 'Admin private data' } })
    localStorage.setItem(SESSION_EVENT_KEY, 'new-session')
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: SESSION_EVENT_KEY, newValue: 'new-session' })))
    await screen.findByText('employee:e1')
    expect((screen.getByLabelText('Private draft') as HTMLInputElement).value).toBe('')
  })

  it('logs out on the server before clearing the local account', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(admin)).mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    render(<AuthProvider><SessionView /></AuthProvider>)
    await screen.findByText('admin:a1')
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    await screen.findByText('guest')
    expect(fetch.mock.calls[1]?.[0]).toBe('/api/auth/logout')
    expect(localStorage.getItem(SESSION_EVENT_KEY)).toBeTruthy()
  })

  it('invalidates private data when an API request detects expiry', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(admin)).mockResolvedValueOnce(json({ error: 'Sign in required.' }, 401)).mockResolvedValueOnce(json({ error: 'Sign in required.' }, 401))
    vi.stubGlobal('fetch', fetch)
    render(<AuthProvider><SessionView /></AuthProvider>)
    await screen.findByText('admin:a1')
    await act(async () => { await expect(api('/services')).rejects.toMatchObject({ status: 401 }) })
    await screen.findByText('guest')
  })
})

describe('API response isolation', () => {
  it('sends cookies rather than user identity headers', async () => {
    const fetch = vi.fn().mockResolvedValue(json([]))
    vi.stubGlobal('fetch', fetch)
    await api('/services')
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin', headers: {} })
  })

  it('discards a response after another tab changes the session', async () => {
    let resolve!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done })))
    const pending = api('/me/history')
    localStorage.setItem(SESSION_EVENT_KEY, 'different-account')
    resolve(json([{ private: true }]))
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('also guards session changes while decoding the response body', async () => {
    let resolve!: (body: unknown) => void
    const parse = vi.fn(() => new Promise(done => { resolve = done }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: parse }))
    const pending = api('/me/history')
    await waitFor(() => expect(parse).toHaveBeenCalled())
    invalidateSessionRequests()
    resolve([{ private: true }])
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
