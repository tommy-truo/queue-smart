import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findUserById } from '../src/modules/auth.ts'
import { listHistory } from '../src/modules/history.ts'
import { listNotifications } from '../src/modules/notifications.ts'
import { getQueue, joinQueue, leaveQueue, myQueues, queueSummary, removeFromQueue, reorder, requeue, serveNext } from '../src/modules/queue.ts'
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

describe('removeFromQueue', () => {
  it('drops a waiting person, records history, and notifies them', () => {
    const removed = removeFromQueue('s1', 'q3')
    expect(removed).toMatchObject({ userName: 'Alex Kim', status: 'waiting', outcome: 'removed' })
    expect(getQueue('s1').map((e) => e.userName)).toEqual(['Jordan Lee', 'Sam Patel'])
    expect(listHistory('u1')[0]).toMatchObject({ serviceName: 'Academic Advising', outcome: 'removed' })
    expect(listNotifications('u1')[0].message).toMatch(/removed from the queue for Academic Advising/)
    expect(myQueues('u1')).toEqual([])
  })

  it('promotes the next waiting person without calling them up', () => {
    removeFromQueue('s1', 'q2')
    const queue = getQueue('s1')
    expect(queue.map((e) => e.userName)).toEqual(['Jordan Lee', 'Alex Kim'])
    expect(queue[0].status).toBe('serving')
    expect(queue[1]).toMatchObject({ status: 'almost-ready', position: 1 })
    expect(listNotifications('u1')[0].message).toMatch(/almost up for Academic Advising/)
    expect(listNotifications('u3')[0].message).toMatch(/removed from the queue/)
  })

  it('clears the serving chair without serving that person or calling the next', () => {
    const removed = removeFromQueue('s1', 'q1')
    expect(removed).toMatchObject({ status: 'serving', outcome: 'removed' })
    expect(listHistory('u2')[0].outcome).toBe('removed')
    const queue = getQueue('s1')
    expect(queue.map((e) => [e.userName, e.position, e.status])).toEqual([
      ['Sam Patel', 1, 'almost-ready'],
      ['Alex Kim', 2, 'waiting'],
    ])

    const { served, nowServing } = serveNext('s1')
    expect(served).toBeUndefined()
    expect(nowServing?.userName).toBe('Sam Patel')
  })

  it('fails when that person is not in the line', () => {
    expect(() => removeFromQueue('s1', 'missing')).toThrow(/not in line/)
    expect(() => removeFromQueue('s2', 'q1')).toThrow(/not in line/)
    removeFromQueue('s1', 'q3')
    expect(() => removeFromQueue('s1', 'q3')).toThrow(/not in line/)
  })
})

describe('requeue', () => {
  it('moves the person being served to the end of their priority group', () => {
    const moved = requeue('s1')
    expect(moved).toMatchObject({ userName: 'Jordan Lee', status: 'waiting', priority: 'medium', position: 3 })
    expect(moved.calledAt).toBeUndefined()
    expect(moved.joinedAt > '2026-09-29T09:20:00').toBe(true)
    expect(getQueue('s1').map((entry) => [entry.userName, entry.position, entry.status])).toEqual([
      ['Sam Patel', 1, 'almost-ready'],
      ['Alex Kim', 2, 'waiting'],
      ['Jordan Lee', 3, 'waiting'],
    ])
    expect(listHistory('u2')).toEqual([])
    expect(listNotifications('u2').map((note) => note.message)).toEqual([
      'You were placed back in line for Academic Advising.',
    ])
    expect(myQueues('u2')).toEqual([expect.objectContaining({ serviceId: 's1', position: 3 })])
  })

  it('keeps a higher priority ahead and sends the requeued person behind their own group', () => {
    joinQueue(user('u4'), 's1', { priority: 'high' })
    requeue('s1')
    expect(getQueue('s1').map((entry) => entry.userName)).toEqual(['Riley Chen', 'Sam Patel', 'Alex Kim', 'Jordan Lee'])
  })

  it('calls the next person in the same priority group instead of the requeued person', () => {
    requeue('s1')
    const { served, nowServing } = serveNext('s1')
    expect(served).toBeUndefined()
    expect(nowServing?.userName).toBe('Sam Patel')
    expect(getQueue('s1').map((entry) => entry.userName)).toEqual(['Sam Patel', 'Alex Kim', 'Jordan Lee'])
  })

  it('notifies them again when they land at the front, and serve next calls them before a lower priority', () => {
    joinQueue(user('u1'), 's2', { priority: 'low' })
    serveNext('s2')
    const moved = requeue('s2')
    expect(moved).toMatchObject({ userName: 'Riley Chen', position: 1, status: 'almost-ready' })
    expect(getQueue('s2').some((entry) => entry.status === 'serving')).toBe(false)
    const messages = listNotifications('u4').map((note) => note.message)
    expect(messages).toEqual(expect.arrayContaining([
      'You were placed back in line for Financial Aid Help Desk.',
      'You are almost up for Financial Aid Help Desk.',
    ]))
    expect(listHistory('u4')).toEqual([])

    const { served, nowServing } = serveNext('s2')
    expect(served).toBeUndefined()
    expect(nowServing?.userName).toBe('Riley Chen')
  })

  it('fails when no one is being served', () => {
    expect(() => requeue('s3')).toThrow(/No one is being served/)
    expect(() => requeue('s4')).toThrow(/No one is being served/)
    expect(() => requeue('missing')).toThrow(/not found/i)
  })
})

describe('reorder', () => {
  it('moves a waiting person down and back up within the same priority group', () => {
    const down = reorder('s1', 'q2', { direction: 'down' })
    expect(down).toMatchObject({ userName: 'Sam Patel', position: 2, status: 'waiting' })
    expect(getQueue('s1').map((e) => e.userName)).toEqual(['Jordan Lee', 'Alex Kim', 'Sam Patel'])

    const up = reorder('s1', 'q2', { direction: 'up' })
    expect(up).toMatchObject({ userName: 'Sam Patel', position: 1, status: 'almost-ready' })
    expect(getQueue('s1').map((e) => e.userName)).toEqual(['Jordan Lee', 'Sam Patel', 'Alex Kim'])
  })

  it('keeps a cross-priority move on the next read', () => {
    joinQueue(user('u4'), 's1', { priority: 'high' })
    reorder('s1', 'q2', { direction: 'up' })
    expect(getQueue('s1').map((e) => e.userName)).toEqual(['Jordan Lee', 'Sam Patel', 'Riley Chen', 'Alex Kim'])
    expect(getQueue('s1').map((e) => e.userName)).toEqual(['Jordan Lee', 'Sam Patel', 'Riley Chen', 'Alex Kim'])
  })

  it('refuses to move the person being served or past the ends', () => {
    expect(() => reorder('s1', 'q1', { direction: 'down' })).toThrow(/being served/)
    expect(() => reorder('s1', 'q2', { direction: 'up' })).toThrow(/cannot move up/)
    expect(() => reorder('s1', 'q3', { direction: 'down' })).toThrow(/cannot move down/)
  })

  it('updates almost-ready for the new next person without a reorder notification', () => {
    reorder('s1', 'q3', { direction: 'up' })
    const queue = getQueue('s1')
    expect(queue.map((e) => [e.userName, e.position, e.status])).toEqual([
      ['Jordan Lee', 0, 'serving'],
      ['Alex Kim', 1, 'almost-ready'],
      ['Sam Patel', 2, 'waiting'],
    ])
    expect(listNotifications('u1').some((n) => n.message.match(/almost up for Academic Advising/))).toBe(true)
    expect(listNotifications('u3').some((n) => n.message.match(/reorder|moved/i))).toBe(false)
  })

  it('slots a new join by priority without undoing manual order', () => {
    joinQueue(user('u4'), 's1', { priority: 'high' })
    reorder('s1', 'q2', { direction: 'up' })
    joinQueue(user('u5'), 's1', { priority: 'high' })
    expect(getQueue('s1').map((e) => e.userName)).toEqual([
      'Jordan Lee',
      'Morgan Diaz',
      'Sam Patel',
      'Riley Chen',
      'Alex Kim',
    ])
  })

  it('requeue still lands at the end of the same priority group when ranks exist', () => {
    reorder('s1', 'q3', { direction: 'up' })
    requeue('s1')
    expect(getQueue('s1').map((e) => e.userName)).toEqual(['Alex Kim', 'Sam Patel', 'Jordan Lee'])
  })

  it('fails when that person is not in the line', () => {
    expect(() => reorder('missing', 'q1', { direction: 'up' })).toThrow(/not found/i)
    expect(() => reorder('s1', 'missing', { direction: 'up' })).toThrow(/not in line/)
    removeFromQueue('s1', 'q3')
    expect(() => reorder('s1', 'q3', { direction: 'up' })).toThrow(/not in line/)
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
