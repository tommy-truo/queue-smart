import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDatabase } from '../src/db.ts'
import { findUserById } from '../src/modules/auth.ts'
import { assignPriority, getQueue, joinQueue, reorder } from '../src/modules/queue.ts'
import { getService, updateService } from '../src/modules/services.ts'
import { validate } from '../src/validation.ts'

beforeEach(() => {
  resetDatabase()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('request validation regressions', () => {
  it.each([null, [], 'text', 5, true, undefined])('rejects a non-object request body: %s', body => {
    expect(validate(body, {}, true)).toHaveProperty('body')
    expect(() => updateService('s1', body)).toThrow('Invalid input')
  })

  it.each(['name', 'description', 'expectedDuration', 'priority', 'notification', 'open'])('rejects explicit null %s without changing the service', field => {
    const before = getService('s1')
    expect(() => updateService('s1', { [field]: null })).toThrow('Invalid input')
    expect(getService('s1')).toEqual(before)
  })

  it.each([{}, { direction: null }, { direction: 'sideways' }, null, []])('requires an explicit valid reorder direction', body => {
    const before = getQueue('s1')
    expect(() => reorder('s1', 'q2', body)).toThrow('Invalid input')
    expect(getQueue('s1')).toEqual(before)
  })
})

describe('priority assignment', () => {
  it.each(['high', 'low', null])('prevents regular users from choosing priority %s', priority => {
    expect(() => joinQueue(findUserById('u1')!, 's3', { priority })).toThrow('Invalid input')
    expect(getQueue('s3')).toHaveLength(2)
  })

  it('promotes waiting entries, preserves serving position, and demotes behind equal ranks', () => {
    const entry = joinQueue(findUserById('u4')!, 's1', {})
    expect(assignPriority('s1', entry.id, { priority: 'high' }).position).toBe(1)
    expect(getQueue('s1')[0].id).toBe('q1')
    expect(assignPriority('s1', entry.id, { priority: 'medium' }).position).toBe(3)
    expect(assignPriority('s1', 'q1', { priority: 'low' }).status).toBe('serving')
    expect(assignPriority('s1', 'q1', { priority: 'low' }).position).toBe(0)
  })

  it('rejects missing, invalid, and foreign entries', () => {
    expect(() => assignPriority('s1', 'q2', {})).toThrow('Invalid input')
    expect(() => assignPriority('s1', 'q2', { priority: 'urgent' })).toThrow('Invalid input')
    expect(() => assignPriority('s1', 'q4', { priority: 'high' })).toThrow(/not in line/)
  })
})
