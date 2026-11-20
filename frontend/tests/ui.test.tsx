import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/api.ts'
import WaitByHourChart from '../src/pages/admin/WaitByHourChart.tsx'
import ServiceManagement from '../src/pages/admin/ServiceManagement.tsx'
import AdminDashboard from '../src/pages/admin/AdminDashboard.tsx'
import QueueManagement from '../src/pages/admin/QueueManagement.tsx'
import History from '../src/pages/user/History.tsx'
import ConfirmModal from '../src/components/ConfirmModal.tsx'
import ErrorBoundary from '../src/components/ErrorBoundary.tsx'
import App from '../src/App.tsx'

vi.mock('../src/api.ts', () => ({ api: vi.fn(), ApiError: class extends Error {}, download: vi.fn() }))
vi.mock('../src/auth/AuthContext.ts', () => ({ useAuth: () => ({ user: { id: 'a1' }, role: 'admin', logout: vi.fn() }), homePath: { admin: '/admin' } }))
const mockApi = vi.mocked(api)
beforeEach(() => mockApi.mockReset())

describe('QA regressions', () => {
  it('renders zero-minute historical waits without a crash', async () => {
    mockApi.mockResolvedValue([{ hour: 10, visits: 2, averageWait: 0 }])
    render(<WaitByHourChart query="" />)
    await screen.findByRole('img', { name: /Longest at 10 AM, 0 minutes/ })
  })

  it('clears optional notification text when switching to a service without one', async () => {
    mockApi.mockResolvedValue([
      { id: 'a', name: 'First', description: 'First service', expectedDuration: 5, priority: 'medium', notification: 'Bring your ID' },
      { id: 'b', name: 'Second', description: 'Second service', expectedDuration: 5, priority: 'medium' },
    ])
    render(<ServiceManagement />)
    const edit = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(edit[0])
    expect((screen.getByLabelText('Notification message (optional)') as HTMLTextAreaElement).value).toBe('Bring your ID')
    fireEvent.click(edit[1])
    expect((screen.getByLabelText('Notification message (optional)') as HTMLTextAreaElement).value).toBe('')
  })

  it('uses the requested service and saves a staff priority change', async () => {
    const services = [{ id: 'first', name: 'First', expectedDuration: 5 }, { id: 'chosen', name: 'Chosen', expectedDuration: 5 }]
    mockApi.mockImplementation(async (path) => path === '/services' ? services : path?.endsWith('/priority') ? {} : [{ id: 'q1', serviceId: 'chosen', userName: 'Alex', status: 'waiting', position: 1, priority: 'medium', joinedAt: '2026-11-19T10:00:00' }])
    render(<MemoryRouter initialEntries={['/admin/queue?serviceId=chosen']}><QueueManagement /></MemoryRouter>)
    const priority = await screen.findByRole('combobox', { name: 'Priority for Alex' })
    expect((screen.getByRole('combobox', { name: 'Service' }) as HTMLSelectElement).value).toBe('chosen')
    await userEvent.selectOptions(priority, 'high')
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/queues/chosen/entries/q1/priority', { method: 'POST', body: { priority: 'high' } }))
  })

  it('links each dashboard service to its own queue', async () => {
    mockApi.mockImplementation(async path => path === '/services' ? [{ id: 'custom', name: 'Help', priority: 'medium', queueLength: 0, open: true }] : [])
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
    const link = await screen.findByRole('link', { name: 'View queue' })
    expect(link.getAttribute('href')).toBe('/admin/queue?serviceId=custom')
  })

  it('allows keyboard activation of history sorting', async () => {
    mockApi.mockResolvedValue([{ id: 'h1', serviceName: 'Zebra', date: '2026-11-19', outcome: 'served' }, { id: 'h2', serviceName: 'Alpha', date: '2026-11-18', outcome: 'served' }])
    render(<History />)
    const button = await screen.findByRole('button', { name: /Service/ })
    button.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getAllByRole('row')[1].textContent).toContain('Alpha')
  })

  it('names confirmation dialogs for assistive technology', () => {
    render(<ConfirmModal open title="Remove Alex?" message="Remove Alex from Help?" onCancel={() => {}} onConfirm={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Remove Alex?' })).toBeTruthy()
  })

  it('provides a recovery page for unknown routes', () => {
    render(<MemoryRouter initialEntries={['/missing']}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Return to your dashboard' })).toBeTruthy()
  })

  it('catches render failures with a recovery link', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Broken() { throw new Error('Rendering failed') }
    render(<ErrorBoundary><Broken /></ErrorBoundary>)
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Return to QueueSmart' })).toBeTruthy()
    log.mockRestore()
  })
})
