import { beforeEach, describe, expect, it } from 'vitest'
import { createService, getService, listServices, updateService } from '../src/modules/services.ts'
import { resetStore } from '../src/store.ts'

const valid = { name: 'Library Help', description: 'Book holds and renewals.', expectedDuration: 5, priority: 'low', notification: 'please bring library card' }

beforeEach(resetStore)

describe('services', () => {
  it('lists the seeded services', () => {
    expect(listServices()).toHaveLength(4)
  })

  it('creates an open service by default', () => {
    const service = createService(valid)
    expect(service).toMatchObject({ ...valid, open: true })
    expect(listServices()).toHaveLength(5)
  })

  it('requires every field on create', () => {
    expect(() => createService({ name: 'Only a name' })).toThrow('Invalid input')
  })

  it('limits the name to 100 characters', () => {
    expect(() => createService({ ...valid, name: 'x'.repeat(101) })).toThrow('Invalid input')
  })

  it('rejects an unknown priority', () => {
    expect(() => createService({ ...valid, priority: 'urgent' })).toThrow('Invalid input')
  })

  it('rejects a non-positive or fractional duration', () => {
    expect(() => createService({ ...valid, expectedDuration: 0 })).toThrow('Invalid input')
    expect(() => createService({ ...valid, expectedDuration: 2.5 })).toThrow('Invalid input')
  })

  it('updates only the given fields', () => {
    const ser1 = updateService('s1', { expectedDuration: 25, open: false })
    expect(ser1).toMatchObject({ name: 'Academic Advising', expectedDuration: 25, open: false })
    const ser2 = updateService('s2', { name: 'Financial Aid', priority: 'high'})
    expect(ser2).toMatchObject({ name: 'Financial Aid', description: 'Questions about aid packages, deadlines and paperwork.', priority: 'high'})
    const ser3 = updateService('s3', { description: 'Device troubleshooting.', notification: 'Please bring your student ID and laptop.'})
    expect(ser3).toMatchObject({ name: 'IT Support', description: 'Device troubleshooting.', notification: 'Please bring your student ID and laptop.'})
  })

  it('validates fields on update', () => {
    expect(() => updateService('s1', { name: '' })).toThrow('Invalid input')
  })

  it('returns 404 for an unknown service', () => {
    expect(() => getService('missing')).toThrow('Service not found.')
    expect(() => updateService('missing', {})).toThrow('Service not found.')
  })
})
