import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/api.ts'
import JoinQueue from '../src/pages/user/JoinQueue.tsx'
import QueueStatus from '../src/pages/user/QueueStatus.tsx'
import QueueReminders from '../src/components/QueueReminders.tsx'
import LiveWait from '../src/components/LiveWait.tsx'

vi.mock('../src/api.ts', () => ({ api: vi.fn() }))
vi.mock('../src/auth/AuthContext.ts', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
const mockApi = vi.mocked(api)
const service = { id: 's', name: 'IT Support', description: 'Device help', expectedDuration: 15, open: true, estimatedWait: 20 }
const baseEntry = { id: 'q', serviceId: 's', userName: 'Alex', userId: 'u1', priority: 'medium' as const, status: 'waiting' as const, joinedAt: '2026-11-19T10:00:00', position: 2, estimatedWait: 8, estimatedWaitSeconds: 450, estimateUpdatedAt: 100, peopleAhead: 2, countdownFloorSeconds: 300, reminderMinutes: 10, awaitingStaff: false, serviceDelayed: false }
beforeEach(() => mockApi.mockReset())
afterEach(() => vi.useRealTimers())

describe('reminder preferences', () => {
  it('defaults to ten minutes and sends the chosen preference on join', async () => {
    mockApi.mockImplementation(async path => path === '/services' ? [service] : path?.endsWith('/join') ? baseEntry : [])
    render(<JoinQueue />)
    await userEvent.selectOptions(await screen.findByLabelText('Service'), 's')
    const choice = screen.getByLabelText('Remind me before service') as HTMLSelectElement
    expect(choice.value).toBe('10')
    await userEvent.selectOptions(choice, '15')
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/queues/s/join', { method: 'POST', body: { reminderMinutes: 15 } }))
  })

  it('saves changes for the current visit and reports that a sent reminder will not repeat', async () => {
    mockApi.mockImplementation(async path => path === '/services' ? [service] : path?.endsWith('/reminder') ? baseEntry : [{ ...baseEntry, reminderSentAt: '2026-11-19T10:00:00' }])
    render(<MemoryRouter><QueueStatus /></MemoryRouter>)
    await userEvent.selectOptions(await screen.findByLabelText('Reminder for IT Support'), '5')
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/queues/s/reminder', { method: 'PUT', body: { entryId: 'q', reminderMinutes: 5 } }))
    expect(screen.getByText(/Changing the setting will not send another/)).toBeTruthy()
    expect(screen.getAllByRole('cell')[3].textContent).toBe('2')
  })

  it('disables preference edits while the customer is being served', async () => {
    mockApi.mockImplementation(async path => path === '/services' ? [service] : [{ ...baseEntry, status: 'serving' }])
    render(<MemoryRouter><QueueStatus /></MemoryRouter>)
    expect((await screen.findByLabelText('Reminder for IT Support') as HTMLSelectElement).disabled).toBe(true)
  })
})

describe('visible reminder banner', () => {
  it('shows the saved alert and dismisses it through the owner endpoint', async () => {
    let entry = { ...baseEntry, reminderSentAt: '2026-11-19T10:00:00', reminderNotificationId: 'n1', reminderDismissed: false, reminderWaitMinutes: 8, reminderLeadMinutes: 10 }
    mockApi.mockImplementation(async path => {
      if (path === '/services') return [service]
      if (path?.endsWith('/dismiss')) { entry = { ...entry, reminderDismissed: true }; return entry }
      return [entry]
    })
    render(<QueueReminders />)
    expect(await screen.findByText('Get ready for IT Support')).toBeTruthy()
    expect(screen.getByText(/requested a 10-minute reminder/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss reminder for IT Support' }))
    await waitFor(() => expect(screen.queryByText('Get ready for IT Support')).toBeNull())
    expect(mockApi).toHaveBeenCalledWith('/queues/s/reminder/dismiss', { method: 'POST', body: { notificationId: 'n1' } })
  })

  it('hides a reminder when called and allows the requeued waiting period to display a new one', async () => {
    let entry: Record<string, unknown> = { ...baseEntry, reminderNotificationId: 'n1', reminderDismissed: false }
    mockApi.mockImplementation(async path => path === '/services' ? [service] : [entry])
    render(<QueueReminders />)
    await screen.findByText('Get ready for IT Support')
    entry = { ...entry, status: 'serving' }
    fireEvent.focus(window)
    await waitFor(() => expect(screen.queryByText('Get ready for IT Support')).toBeNull())
    entry = { ...entry, status: 'waiting', reminderNotificationId: 'n2' }
    fireEvent.focus(window)
    await screen.findByText('Get ready for IT Support')
  })
})

describe('live countdown', () => {
  it('ticks only the active-service portion and stops at the waiting-time floor', async () => {
    vi.useFakeTimers()
    render(<LiveWait entry={baseEntry} />)
    expect(screen.getByText('7 min 30 sec')).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.getByText('7 min 29 sec')).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000) })
    expect(screen.getByText('5 min 00 sec')).toBeTruthy()
  })

  it.each(['awaitingStaff', 'serviceDelayed'])('does not count down when %s is true', async flag => {
    vi.useFakeTimers()
    render(<LiveWait entry={{ ...baseEntry, [flag]: true }} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(screen.getByText(/7 min 30 sec/)).toBeTruthy()
    expect(screen.getByText(flag === 'awaitingStaff' ? /Waiting for staff/ : /taking longer than expected/)).toBeTruthy()
  })

  it('shows the waiting state instead of a zero countdown when service is idle or overdue', () => {
    const ready = { ...baseEntry, estimatedWaitSeconds: 0 }
    const { rerender } = render(<LiveWait entry={{ ...ready, awaitingStaff: true }} />)
    expect(screen.getByText(/Waiting for staff to call/)).toBeTruthy()
    rerender(<LiveWait entry={{ ...ready, serviceDelayed: true }} />)
    expect(screen.getByText(/Waiting for current service to finish/)).toBeTruthy()
    expect(screen.queryByText('0 min 00 sec')).toBeNull()
  })

  it('reanchors to a new estimate after the queue changes', async () => {
    vi.useFakeTimers()
    const { rerender } = render(<LiveWait entry={baseEntry} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    rerender(<LiveWait entry={{ ...baseEntry, estimatedWaitSeconds: 900, estimateUpdatedAt: 200 }} />)
    expect(screen.getByText('15 min 00 sec')).toBeTruthy()
  })
})
