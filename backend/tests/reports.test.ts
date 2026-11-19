import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.ts'
import { parseFilters, participationReport, serviceActivityReport, toCsv } from '../src/modules/reports.ts'
import { resetStore } from '../src/store.ts'

const app = createApp()

beforeEach(() => {
  resetStore()
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

describe('csv', () => {
  it('quotes cells with commas or quotes', () => {
    expect(toCsv([{ a: 'x, y', b: 'say "hi"', c: null }], ['a', 'b', 'c'])).toBe('a,b,c\n"x, y","say ""hi""",\n')
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
    expect(res.text.split('\n')[0]).toBe('userName,email,serviceName,date,outcome')
  })

  it('return 404 for an unknown service', async () => {
    const res = await request(app).get('/api/reports/services?serviceId=nope').set('x-user-id', 'a1')
    expect(res.status).toBe(404)
  })
})
