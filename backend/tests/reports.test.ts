import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.ts'
import { parseFilters, participationReport, serviceActivityReport, toCsv, waitByHourReport } from '../src/modules/reports.ts'
import { resetDatabase } from '../src/db.ts'

const app = createApp()

beforeEach(() => {
  resetDatabase()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('report filters', () => {
  it('keeps valid dates and service id, skips blanks', () => {
    expect(parseFilters({ from: '2026-09-01', to: '', serviceId: 's1' })).toEqual({ from: '2026-09-01', serviceId: 's1' })
  })

  it('rejects bad dates', () => {
    expect(() => parseFilters({ from: '09/01/2026' })).toThrow(/from must be a date/)
  })
})

describe('participation report', () => {
  it('lists every history row with the user, newest first', () => {
    const rows = participationReport({})
    expect(rows).toHaveLength(9)
    expect(rows[0]).toEqual({
      userName: 'Casey Wong',
      email: 'casey.wong@example.com',
      serviceName: 'Academic Advising',
      date: '2026-09-24',
      outcome: 'served',
    })
  })

  it('filters by date range and service', () => {
    const rows = participationReport({ from: '2026-09-10', to: '2026-09-20', serviceId: 's2' })
    expect(rows.map(r => r.date)).toEqual(['2026-09-18', '2026-09-15'])
  })
})

describe('service activity report', () => {
  it('counts outcomes and averages the actual wait', () => {
    const [advising] = serviceActivityReport({ serviceId: 's1' })
    expect(advising).toMatchObject({ serviceName: 'Academic Advising', waitingNow: 3, served: 2, averageWait: 20 })
  })

  it('returns null average wait when no one has been called', () => {
    const rows = serviceActivityReport({})
    expect(rows.find(r => r.serviceName === 'IT Support')?.averageWait).toBeNull()
  })
})

describe('wait by hour report', () => {
  it('averages waits by the hour people joined', () => {
    // Seed: one person joined Academic Advising at 9:05 and was called at 9:25.
    expect(waitByHourReport({})).toEqual([{ hour: 9, visits: 1, averageWait: 20 }])
  })

  it('applies filters', () => {
    expect(waitByHourReport({ serviceId: 's2' })).toEqual([])
    expect(waitByHourReport({ from: '2026-09-30' })).toEqual([])
    expect(() => waitByHourReport({ serviceId: 'nope' })).toThrow(/Service not found/)
  })
})

describe('csv', () => {
  it('writes readable headings and quotes cells with commas or quotes', () => {
    const columns: [string, string][] = [['a', 'A'], ['b', 'B, quoted'], ['c', 'C']]
    expect(toCsv([{ a: 'x, y', b: 'say "hi"', c: null }], columns)).toBe('A,"B, quoted",C\n"x, y","say ""hi""",\n')
  })
})

describe('report routes', () => {
  it('are admin only', async () => {
    expect((await request(app).get('/api/reports/services').set('x-user-id', 'u1')).status).toBe(403)
  })

  it('return JSON by default', async () => {
    const res = await request(app).get('/api/reports/services').set('x-user-id', 'a1')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('download CSV on request', async () => {
    const res = await request(app).get('/api/reports/participation?format=csv&serviceId=s1').set('x-user-id', 'a1')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toMatch(/participation\.csv/)
    expect(res.text.split('\n')[0]).toBe('User,Email,Service,Date,Outcome')
  })

  it('add the wait-by-hour numbers to the service activity CSV', async () => {
    const res = await request(app).get('/api/reports/services?format=csv').set('x-user-id', 'a1')
    const sections = res.text.split('\n\n')
    expect(sections).toHaveLength(2)
    expect(sections[0].split('\n')[0]).toMatch(/^Service,/)
    expect(sections[1].split('\n').slice(0, 3)).toEqual(['Average wait by time of day', 'Hour (0-23),Visits called,Average wait (min)', '9,1,20'])
  })

  it('serve the wait-by-hour chart data', async () => {
    const res = await request(app).get('/api/reports/wait-by-hour').set('x-user-id', 'a1')
    expect(res.status).toBe(200)
    expect(res.body[0]).toEqual({ hour: 9, visits: 1, averageWait: 20 })
  })

  it('return 404 for an unknown service', async () => {
    const res = await request(app).get('/api/reports/services?serviceId=nope').set('x-user-id', 'a1')
    expect(res.status).toBe(404)
  })
})
