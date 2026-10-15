import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findUserById } from '../src/modules/auth.ts'
import { listHistory } from '../src/modules/history.ts'
import { listNotifications } from '../src/modules/notifications.ts'
import { getQueue, joinQueue, leaveQueue, myQueues, queueSummary, serveNext } from '../src/modules/queue.ts'
import { getService } from '../src/modules/services.ts'
import { estimateWait } from '../src/modules/waitTime.ts'
import { resetStore } from '../src/store.ts'

const user = (id: string) => findUserById(id)!

beforeEach(() => {
  resetStore()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('estimateWait', () => {
  it('multiplies people ahead by the expected duration', () => {
    expect(estimateWait(3, 10)).toBe(30)
    expect(estimateWait(0, 10)).toBe(0)
    expect(estimateWait(-1, 10)).toBe(0)
  })
})

describe('getQueue', () => {
  it('puts the person being served first with position 0', () => {
    const queue = getQueue('s1')
    expect(queue.map((e) => [e.userName, e.position, e.estimatedWait])).toEqual([
      ['Jordan Lee', 0, 0],
      ['Sam Patel', 1, 15],
      ['Alex Kim', 2, 30],
    ])
  })

  it('starts positions at 1 when no one is being served', () => {
    expect(getQueue('s3').map((e) => e.position)).toEqual([1, 2])
  })

  it('summarizes length and the wait for someone joining now', () => {
    expect(queueSummary(getService('s1'))).toEqual({ queueLength: 3, estimatedWait: 45 })
  })
})

describe('joinQueue', () => {
  it('adds the user to the end of the line and notifies them', () => {
    const entry = joinQueue(user('u1'), 's3', {})
    expect(entry).toMatchObject({ userId: 'u1', status: 'waiting', position: 3, estimatedWait: 40 })
    expect(listNotifications('u1')[0].message).toMatch(/joined the queue for IT Support/)
  })

  it('orders higher priority ahead of earlier arrivals', () => {
    const entry = joinQueue(user('u1'), 's3', { priority: 'high' })
    expect(entry.position).toBe(1)
    expect(getQueue('s3').map((e) => e.userName)).toEqual(['Alex Kim', 'Morgan Diaz', 'Casey Wong'])
  })

  it('never jumps ahead of the person being served', () => {
    joinQueue(user('u4'), 's1', { priority: 'high' })
    expect(getQueue('s1')[0].userName).toBe('Jordan Lee')
    expect(getQueue('s1')[1].userName).toBe('Riley Chen')
  })

  it('moves someone pushed back by priority from almost ready to waiting', () => {
    joinQueue(user('u1'), 's3', { priority: 'high' })
    const morgan = getQueue('s3').find((e) => e.userName === 'Morgan Diaz')!
    expect(morgan.status).toBe('waiting')
  })

  it('rejects joining a closed service', () => {
    expect(() => joinQueue(user('u1'), 's4', {})).toThrow(/not accepting/)
  })

  it('rejects joining the same queue twice', () => {
    expect(() => joinQueue(user('u1'), 's1', {})).toThrow(/already in line/)
  })

  it('validates the priority', () => {
    expect(() => joinQueue(user('u1'), 's3', { priority: 'urgent' })).toThrow('Invalid input')
  })
})

describe('leaveQueue', () => {
  it('removes the user and records history', () => {
    leaveQueue(user('u1'), 's1')
    expect(getQueue('s1').map((e) => e.userId)).not.toContain('u1')
    expect(listHistory('u1')[0]).toMatchObject({ serviceName: 'Academic Advising', outcome: 'left' })
  })

  it('fails when the user is not in line', () => {
    expect(() => leaveQueue(user('u1'), 's2')).toThrow(/not in line/)
  })
})

describe('serveNext', () => {
  it('finishes the current person and calls the next one', () => {
    const { served, nowServing } = serveNext('s1')
    expect(served?.userName).toBe('Jordan Lee')
    expect(nowServing?.userName).toBe('Sam Patel')
    expect(listHistory('u2')[0].outcome).toBe('served')
    expect(listNotifications('u3')[0].message).toMatch(/your turn/)
  })

  it('notifies the person who becomes next in line', () => {
    serveNext('s1')
    const alex = getQueue('s1').find((e) => e.userId === 'u1')!
    expect(alex).toMatchObject({ position: 1, status: 'almost-ready' })
    expect(listNotifications('u1')[0].message).toMatch(/almost up for Academic Advising/)
  })

  it('calls the first person when no one is being served', () => {
    const { served, nowServing } = serveNext('s3')
    expect(served).toBeUndefined()
    expect(nowServing?.userName).toBe('Morgan Diaz')
  })

  it('finishes the last person and leaves the queue empty', () => {
    serveNext('s2')
    const { served, nowServing } = serveNext('s2')
    expect(served?.userName).toBe('Riley Chen')
    expect(nowServing).toBeUndefined()
    expect(getQueue('s2')).toEqual([])
  })

  it('fails on an empty queue', () => {
    expect(() => serveNext('s4')).toThrow(/No one is waiting/)
  })
})

describe('myQueues', () => {
  it('returns the user active entries with position and wait', () => {
    expect(myQueues('u1')).toEqual([expect.objectContaining({ serviceId: 's1', position: 2, estimatedWait: 30 })])
  })

  it('is empty after leaving', () => {
    leaveQueue(user('u1'), 's1')
    expect(myQueues('u1')).toEqual([])
  })
})
