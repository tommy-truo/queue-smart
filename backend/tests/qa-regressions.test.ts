import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb, resetDatabase } from '../src/db.ts'
import { findUserById } from '../src/modules/auth.ts'
import { assignPriority, getQueue, joinQueue, leaveQueue, removeFromQueue, reorder, requeue, serveNext } from '../src/modules/queue.ts'
import { createService, getService, listServices, updateService } from '../src/modules/services.ts'
import { parseFilters, participationReport, serviceActivityReport, toCsv } from '../src/modules/reports.ts'
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

describe('report input and CSV safety', () => {
  it.each(['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-01', '2026-11-31'])('rejects impossible calendar date %s', from => {
    expect(() => parseFilters({ from })).toThrow(/must be a date/)
  })

  it('accepts leap days and rejects reversed or repeated filters', () => {
    expect(parseFilters({ from: '2028-02-29' })).toEqual({ from: '2028-02-29' })
    expect(() => parseFilters({ from: '2026-11-20', to: '2026-11-19' })).toThrow(/on or before/)
    expect(() => parseFilters({ from: ['2026-01-01', '2026-02-01'] })).toThrow(/must be a date/)
    expect(() => parseFilters({ serviceId: ['s1', 's2'] })).toThrow(/single service ID/)
  })

  it('neutralizes text formulas, preserves numeric negatives, and quotes carriage returns', () => {
    const columns: [string, string][] = [['value', 'Value']]
    const values = ['=1+1', '+SUM(1)', '-1', '@SUM(1)', '  =1+1', '\tformula', 'a\rb', -2]
    expect(toCsv(values.map(value => ({ value })), columns)).toBe("Value\n'=1+1\n'+SUM(1)\n'-1\n'@SUM(1)\n'  =1+1\n'\tformula\n\"a\rb\"\n-2\n")
  })

  it('keeps history attached to its service after renaming and reusing the old name', () => {
    updateService('s1', { name: 'Advising renamed' })
    const replacement = createService({ name: 'Academic Advising', description: 'New service', expectedDuration: 10, priority: 'medium' })
    expect(participationReport({ serviceId: 's1' })).toHaveLength(2)
    expect(participationReport({ serviceId: replacement.id })).toEqual([])
    expect(serviceActivityReport({ serviceId: 's1' })[0].served).toBe(2)
    expect(serviceActivityReport({ serviceId: replacement.id })[0].served).toBe(0)
  })
})

function rejectWrites(table: string): () => void {
  getDb().exec(`CREATE TEMP TRIGGER fail_qa BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'injected QA failure'); END`)
  return () => getDb().exec('DROP TRIGGER fail_qa')
}

describe('atomic multi-table changes', () => {
  it('rolls back a service when its queue cannot be created', () => {
    const cleanup = rejectWrites('Queue')
    try {
      expect(() => createService({ name: 'Failed service', description: 'Test', expectedDuration: 10, priority: 'medium' })).toThrow(/injected QA failure/)
      expect(listServices()).toHaveLength(4)
    } finally { cleanup() }
  })

  it.each(['join', 'remove', 'requeue', 'serve', 'priority', 'reorder'])('rolls back %s when notification insertion fails', operation => {
    const before = getQueue(operation === 'join' ? 's3' : 's1')
    const historyBefore = getDb().prepare('SELECT * FROM History').all()
    const cleanup = rejectWrites('Notification')
    try {
      const actions: Record<string, () => unknown> = {
        join: () => joinQueue(findUserById('u1')!, 's3', {}),
        remove: () => removeFromQueue('s1', 'q2'),
        requeue: () => requeue('s1'),
        serve: () => serveNext('s1'),
        priority: () => assignPriority('s1', 'q3', { priority: 'high' }),
        reorder: () => reorder('s1', 'q3', { direction: 'up' }),
      }
      expect(actions[operation]).toThrow(/injected QA failure/)
      expect(getQueue(operation === 'join' ? 's3' : 's1')).toEqual(before)
      expect(getDb().prepare('SELECT * FROM History').all()).toEqual(historyBefore)
    } finally { cleanup() }
  })

  it('rolls back leaving when history insertion fails', () => {
    const before = getQueue('s1')
    const cleanup = rejectWrites('History')
    try {
      expect(() => leaveQueue(findUserById('u1')!, 's1')).toThrow(/injected QA failure/)
      expect(getQueue('s1')).toEqual(before)
    } finally { cleanup() }
  })

  it('rolls back service fields when updating queue status fails', () => {
    getDb().exec("CREATE TEMP TRIGGER fail_qa BEFORE UPDATE ON Queue BEGIN SELECT RAISE(ABORT, 'injected QA failure'); END")
    const before = getService('s1')
    try {
      expect(() => updateService('s1', { name: 'Should roll back', open: false })).toThrow(/injected QA failure/)
      expect(getService('s1')).toEqual(before)
    } finally { getDb().exec('DROP TRIGGER fail_qa') }
  })
})
