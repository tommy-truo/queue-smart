import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDatabase } from '../src/db.ts'
import { getQueue, reorder } from '../src/modules/queue.ts'
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
