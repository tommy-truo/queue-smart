import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/api.ts'
import { useQueues } from '../src/queues.ts'

vi.mock('../src/api.ts', () => ({ api: vi.fn() }))
vi.mock('../src/auth/AuthContext.ts', () => ({ useAuth: () => ({ user: { id: 'staff' } }) }))
const service = { id: 'custom-service', name: 'Help', expectedDuration: 5, open: true }
const entry = { id: 'q1', serviceId: service.id, userName: 'Alex', position: 1, priority: 'medium' }
const mockApi = vi.mocked(api)

beforeEach(() => { mockApi.mockReset(); mockApi.mockImplementation(async path => path === '/services' ? [service] : [entry]) })
afterEach(() => vi.useRealTimers())

describe('queue refresh and selection', () => {
  it('selects a real service without relying on seeded s1', async () => {
    const { result } = renderHook(() => useQueues(''))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.selectedServiceId).toBe('custom-service')
    expect(mockApi).toHaveBeenCalledWith('/queues/custom-service', expect.anything())
  })

  it('refreshes on focus without blanking existing entries', async () => {
    const { result } = renderHook(() => useQueues(''))
    await waitFor(() => expect(result.current.entries).toHaveLength(1))
    let complete!: (value: unknown) => void
    mockApi.mockImplementation(path => path === '/services' ? Promise.resolve([service]) : new Promise(resolve => { complete = resolve }))
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(result.current.loading).toBe(false)
    expect(result.current.entries[0].id).toBe('q1')
    await act(async () => { complete([{ ...entry, id: 'q2' }]) })
    expect(result.current.entries[0].id).toBe('q2')
  })

  it('polls for changes and keeps the previous view when a background request fails', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useQueues(''))
    await act(async () => {})
    expect(result.current.entries).toHaveLength(1)
    mockApi.mockRejectedValue(new Error('Offline'))
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(result.current.loading).toBe(false)
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.actionError).toBe('Offline')
  })

  it('discards late data for a previously selected service', async () => {
    let complete!: (value: unknown) => void
    mockApi.mockImplementation(path => path === '/services' ? Promise.resolve([service, { ...service, id: 'other' }]) : path.endsWith('/custom-service') ? new Promise(resolve => { complete = resolve }) : Promise.resolve([{ ...entry, id: 'other-entry' }]))
    const { result, rerender } = renderHook(({ selected }) => useQueues(selected), { initialProps: { selected: 'custom-service' } })
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/queues/custom-service', expect.anything()))
    rerender({ selected: 'other' })
    await waitFor(() => expect(result.current.entries[0]?.id).toBe('other-entry'))
    await act(async () => { complete([entry]) })
    expect(result.current.entries[0].id).toBe('other-entry')
  })
})
