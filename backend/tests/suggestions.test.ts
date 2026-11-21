import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.ts'
import { getDb, resetDatabase } from '../src/db.ts'
import { suggestJoinTimes } from '../src/modules/suggestions.ts'

const app = createApp()

beforeEach(() => {
  resetDatabase()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

function addVisit(id: string, queueId: string, joinedAt: string, calledAt: string | null, status: 'served' | 'canceled') {
  getDb()
    .prepare(
      `INSERT INTO QueueEntry (entryId, queueId, userId, position, priority, joinedAt, calledAt, status)
       VALUES (?, ?, 'u1', 1, 'medium', ?, ?, ?)`,
    )
    .run(id, queueId, joinedAt, calledAt, status)
}

describe('join time suggestions', () => {
  it('ranks hours by average wait, then by earlier hour', () => {
    addVisit('t1', 'qu2', '2026-09-29T15:00:00', '2026-09-29T15:05:00', 'served')
    addVisit('t2', 'qu2', '2026-09-29T09:00:00', '2026-09-29T09:10:00', 'served')
    addVisit('t3', 'qu2', '2026-09-29T11:00:00', '2026-09-29T11:40:00', 'served')
    addVisit('t4', 'qu2', '2026-09-29T10:00:00', '2026-09-29T10:10:00', 'served')

    const result = suggestJoinTimes({ serviceId: 's2' })
    expect(result).toMatchObject({ serviceId: 's2', serviceName: 'Financial Aid Help Desk', open: true, deadline: null })
    expect(result.hours).toEqual([
      { hour: 15, averageWait: 5, visits: 1, calledBy: '15:05' },
      { hour: 9, averageWait: 10, visits: 1, calledBy: '09:10' },
      { hour: 10, averageWait: 10, visits: 1, calledBy: '10:10' },
      { hour: 11, averageWait: 40, visits: 1, calledBy: '11:40' },
    ])
  })

  it('rounds the average and ignores visits that were never called', () => {
    addVisit('t1', 'qu2', '2026-09-29T12:00:00', '2026-09-29T12:10:00', 'served')
    addVisit('t2', 'qu2', '2026-09-29T12:20:00', '2026-09-29T12:31:00', 'served')
    addVisit('t3', 'qu2', '2026-09-29T12:40:00', null, 'canceled')

    expect(suggestJoinTimes({ serviceId: 's2' }).hours).toEqual([
      { hour: 12, averageWait: 11, visits: 2, calledBy: '12:11' },
    ])
  })

  it('drops hours that would be called after the deadline and keeps an exact match', () => {
    addVisit('t1', 'qu2', '2026-09-29T09:00:00', '2026-09-29T09:10:00', 'served')
    addVisit('t2', 'qu2', '2026-09-29T11:00:00', '2026-09-29T11:40:00', 'served')

    expect(suggestJoinTimes({ serviceId: 's2', by: '09:30' }).hours.map(hour => hour.hour)).toEqual([9])
    expect(suggestJoinTimes({ serviceId: 's2', by: '09:10' }).hours).toEqual([
      { hour: 9, averageWait: 10, visits: 1, calledBy: '09:10' },
    ])
  })

  it('returns no hours when every usual call is past the deadline', () => {
    addVisit('t1', 'qu2', '2026-09-29T09:00:00', '2026-09-29T09:10:00', 'served')
    const result = suggestJoinTimes({ serviceId: 's2', by: '09:00' })
    expect(result.deadline).toBe('09:00')
    expect(result.hours).toEqual([])
  })

  it('treats a call after midnight as later than any same-day deadline', () => {
    addVisit('t1', 'qu2', '2026-09-29T23:00:00', '2026-09-30T00:30:00', 'served')
    expect(suggestJoinTimes({ serviceId: 's2' }).hours).toEqual([
      { hour: 23, averageWait: 90, visits: 1, calledBy: '00:30' },
    ])
    expect(suggestJoinTimes({ serviceId: 's2', by: '23:59' }).hours).toEqual([])
  })

  it('treats a blank deadline as no deadline', () => {
    addVisit('t1', 'qu2', '2026-09-29T09:00:00', '2026-09-29T09:10:00', 'served')
    expect(suggestJoinTimes({ serviceId: 's2', by: '' }).deadline).toBeNull()
    expect(suggestJoinTimes({ serviceId: 's2', by: '' }).hours).toHaveLength(1)
  })

  it('rejects a missing service and a bad time, and a service that does not exist', () => {
    expect(() => suggestJoinTimes({})).toThrow(/serviceId is required/)
    expect(() => suggestJoinTimes({ serviceId: 's2', by: '9:00' })).toThrow(/by must be a time/)
    expect(() => suggestJoinTimes({ serviceId: 's2', by: '24:00' })).toThrow(/by must be a time/)
    expect(() => suggestJoinTimes({ serviceId: 'nope' })).toThrow(/Service not found/)
  })

  it('still suggests hours for a closed service', () => {
    addVisit('t1', 'qu4', '2026-09-29T10:00:00', '2026-09-29T10:08:00', 'served')
    const result = suggestJoinTimes({ serviceId: 's4' })
    expect(result.open).toBe(false)
    expect(result.serviceName).toBe('Student ID Office')
    expect(result.hours).toEqual([{ hour: 10, averageWait: 8, visits: 1, calledBy: '10:08' }])
  })
})

describe('suggestion route', () => {
  it('requires a signed-in customer', async () => {
    expect((await request(app).get('/api/suggestions?serviceId=s2')).status).toBe(401)
    expect((await request(app).get('/api/suggestions?serviceId=s2').set('x-user-id', 'a1')).status).toBe(403)
    expect((await request(app).get('/api/suggestions?serviceId=s2').set('x-user-id', 'e1')).status).toBe(403)
    const ok = await request(app).get('/api/suggestions?serviceId=s2').set('x-user-id', 'u1')
    expect(ok.status).toBe(200)
    expect(ok.body.hours).toEqual([])
  })

  it('returns 400 and 404 for bad queries', async () => {
    const missing = await request(app).get('/api/suggestions').set('x-user-id', 'u1')
    expect(missing.status).toBe(400)
    const badTime = await request(app).get('/api/suggestions?serviceId=s2&by=25:00').set('x-user-id', 'u1')
    expect(badTime.status).toBe(400)
    const missingService = await request(app).get('/api/suggestions?serviceId=nope').set('x-user-id', 'u1')
    expect(missingService.status).toBe(404)
  })
})
