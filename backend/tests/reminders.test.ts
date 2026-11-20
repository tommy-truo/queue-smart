import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.ts'
import { getDb, openDatabase, resetDatabase } from '../src/db.ts'
import { findUserById } from '../src/modules/auth.ts'
import { createService } from '../src/modules/services.ts'
import { dismissReminder, getQueue, assignPriority, joinQueue, leaveQueue, processQueueReminders, removeFromQueue, requeue, serveNext, updateReminder } from '../src/modules/queue.ts'
import { listNotifications } from '../src/modules/notifications.ts'
import { liveWait } from '../src/modules/waitTime.ts'
import { REMINDER_CHECK_MS, startReminderWorker } from '../src/reminderWorker.ts'
import { cookieFor } from './sessionHelper.ts'

const app = createApp()
const user = (id: string) => findUserById(id)!
const at = (time: string) => vi.setSystemTime(new Date(`2026-09-29T${time}`))
const reminderNotes = (id: string) => listNotifications(id).filter(note => note.message.startsWith('Get ready'))
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  at('09:25:00')
  resetDatabase()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('live wait estimates', () => {
  it('subtracts only elapsed active service and preserves waiting customers ahead', () => {
    at('09:32:30')
    expect(getQueue('s1')[1]).toMatchObject({ estimatedWait: 8, estimatedWaitSeconds: 450, peopleAhead: 1, countdownFloorSeconds: 0 })
    expect(getQueue('s1')[2]).toMatchObject({ estimatedWait: 23, estimatedWaitSeconds: 1350, peopleAhead: 2, countdownFloorSeconds: 900 })
    expect(getQueue('s1')[0]).toMatchObject({ estimatedWait: 0, estimatedWaitSeconds: 0 })
  })

  it('does not count down idle queues and reports delays without negative waits', () => {
    const idle = getQueue('s3').map(entry => entry.estimatedWaitSeconds)
    at('10:30:00')
    expect(getQueue('s3').map(entry => entry.estimatedWaitSeconds)).toEqual(idle)
    expect(getQueue('s3')[0].awaitingStaff).toBe(true)
    expect(getQueue('s1')[1]).toMatchObject({ estimatedWait: 0, serviceDelayed: true })
    expect(getQueue('s1')[2]).toMatchObject({ estimatedWait: 15, serviceDelayed: true })
  })

  it('handles invalid or future legacy service timestamps conservatively', () => {
    expect(liveWait(0, 15, 'invalid')).toMatchObject({ estimatedWait: 15, serviceDelayed: false })
    expect(liveWait(0, 15, '2026-09-30T09:25:00')).toMatchObject({ estimatedWait: 15, serviceDelayed: false })
  })
})

describe('smart reminder behavior', () => {
  it('fires at the chosen threshold as time passes without staff activity, once only', () => {
    at('09:29:59'); processQueueReminders()
    expect(reminderNotes('u3')).toHaveLength(0)
    at('09:30:00'); expect(processQueueReminders()).toBe(1)
    expect(reminderNotes('u3')).toHaveLength(1)
    expect(getQueue('s1')[1]).toMatchObject({ reminderMinutes: 10, reminderWaitMinutes: 10, reminderLeadMinutes: 10, reminderDismissed: false })
    expect(processQueueReminders()).toBe(0)
    at('09:35:00'); processQueueReminders()
    expect(reminderNotes('u3')).toHaveLength(1)
    expect(reminderNotes('u3')[0].message).toContain('estimated wait is about 10 minutes')
  })

  it.each([5, 10, 15])('saves the %i-minute preference and evaluates changes immediately', minutes => {
    at('09:39:00')
    expect(updateReminder(user('u3'), 's1', { reminderMinutes: minutes }).reminderMinutes).toBe(minutes)
    expect(reminderNotes('u3')).toHaveLength(1)
  })

  it.each([null, 0, 6, 20, 10.5, '10'])('rejects invalid reminder preference %s without changing state', minutes => {
    expect(() => updateReminder(user('u3'), 's1', { reminderMinutes: minutes })).toThrow('Invalid input')
    expect(getQueue('s1')[1].reminderMinutes).toBe(10)
    expect(reminderNotes('u3')).toHaveLength(0)
  })

  it('defaults joins to ten minutes and sends an immediate reminder inside the threshold', () => {
    const s = createService({ name: 'Quick help', description: 'Test', expectedDuration: 5, priority: 'medium' })
    const entry = joinQueue(user('u1'), s.id, {})
    expect(entry).toMatchObject({ reminderMinutes: 10, awaitingStaff: true, reminderLeadMinutes: 10, reminderWaitMinutes: 0 })
    expect(entry.reminderNotificationId).toBeTruthy()
    expect(reminderNotes('u1')).toHaveLength(1)
    expect(reminderNotes('u1')[0].message).toContain('Waiting for staff')
    expect(listNotifications('u1').find(note => note.message.startsWith('You joined the queue for Quick help'))?.message).toContain('Waiting for staff to call you.')
  })

  it('uses the selected join threshold and does not rearm an existing reminder when edited', () => {
    const joined = joinQueue(user('u1'), 's3', { reminderMinutes: 15 })
    expect(joined.reminderMinutes).toBe(15)
    expect(joined.reminderSentAt).toBeUndefined()
    const first = updateReminder(user('u3'), 's1', { reminderMinutes: 15 })
    const edited = updateReminder(user('u3'), 's1', { reminderMinutes: 5 })
    expect(edited.reminderNotificationId).toBe(first.reminderNotificationId)
    expect(edited.reminderLeadMinutes).toBe(15)
    expect(reminderNotes('u3')).toHaveLength(1)
    expect(() => joinQueue(user('u4'), 's3', { reminderMinutes: 7 })).toThrow('Invalid input')
  })

  it('reevaluates reminders immediately when someone leaves or staff change priority', () => {
    at('09:30:00')
    expect(getQueue('s1')[2].estimatedWait).toBe(25)
    leaveQueue(user('u3'), 's1')
    expect(reminderNotes('u1')).toHaveLength(1)
    expect(getQueue('s1')[1].reminderWaitMinutes).toBe(10)
    // Pushing the warned customer back never rearms or duplicates their advance reminder.
    joinQueue(user('u4'), 's1', {})
    assignPriority('s1', 'q3', { priority: 'low' })
    expect(reminderNotes('u1')).toHaveLength(1)
    expect(getQueue('s1').find(entry => entry.id === 'q3')?.estimatedWait).toBe(25)
  })

  it('keeps actual-turn alerts separate and permits a fresh reminder after requeue', () => {
    updateReminder(user('u3'), 's1', { reminderMinutes: 15 })
    const oldReminder = getQueue('s1')[1].reminderNotificationId
    serveNext('s1')
    expect(listNotifications('u3')[0].message).toContain('It is your turn')
    expect(() => updateReminder(user('u3'), 's1', { reminderMinutes: 5 })).toThrow(/already started/)
    expect(() => dismissReminder(user('u3'), 's1', { notificationId: oldReminder })).toThrow(/no longer active/)
    const placed = requeue('s1')
    expect(placed.reminderMinutes).toBe(15)
    expect(placed.reminderNotificationId).not.toBe(oldReminder)
    expect(reminderNotes('u3')).toHaveLength(2)
    expect(() => dismissReminder(user('u3'), 's1', { notificationId: oldReminder })).toThrow(/no longer active/)
  })

  it.each(['leave', 'remove', 'call'])('stops advance reminders when a customer is no longer waiting: %s', action => {
    if (action === 'leave') leaveQueue(user('u3'), 's1')
    if (action === 'remove') removeFromQueue('s1', 'q2')
    if (action === 'call') serveNext('s1')
    at('10:00:00'); processQueueReminders()
    expect(reminderNotes('u3')).toHaveLength(0)
  })

  it('persists dismissal and marks only the linked notification viewed', () => {
    const entry = updateReminder(user('u3'), 's1', { reminderMinutes: 15 })
    const result = dismissReminder(user('u3'), 's1', { notificationId: entry.reminderNotificationId })
    expect(result.reminderDismissed).toBe(true)
    expect(reminderNotes('u3')[0].read).toBe(true)
    processQueueReminders()
    expect(reminderNotes('u3')).toHaveLength(1)
    expect(() => dismissReminder(user('u1'), 's1', { notificationId: entry.reminderNotificationId })).toThrow(/no longer active/)
    expect(() => updateReminder(user('u5'), 's1', { reminderMinutes: 5 })).toThrow(/not in this queue/)
  })

  it('rolls back the claim if notification storage fails, then retries safely', () => {
    at('09:30:00')
    getDb().exec("CREATE TEMP TRIGGER reject_reminder BEFORE INSERT ON Notification BEGIN SELECT RAISE(ABORT, 'notification failed'); END")
    try {
      expect(() => processQueueReminders()).toThrow(/notification failed/)
      expect(getQueue('s1')[1].reminderSentAt).toBeUndefined()
    } finally { getDb().exec('DROP TRIGGER reject_reminder') }
    expect(processQueueReminders()).toBe(3)
    expect(reminderNotes('u3')).toHaveLength(1)
  })

  it('stores reminder fields on disk without losing legacy rows or changing the preference on reopen', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-reminders-')); const file = path.join(dir, 'db.sqlite')
    const db = openDatabase(file)
    try {
      db.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)').run('u', 'x@y.co', 'hash', 'user')
      db.prepare('INSERT INTO Service (serviceId,name,description,expectedDuration,priority) VALUES (?,?,?,?,?)').run('s', 'Help', '', 5, 'medium')
      db.prepare('INSERT INTO Queue VALUES (?,?,?,?)').run('q','s','open','2026-09-29')
      db.prepare("INSERT INTO QueueEntry (entryId,queueId,userId,position,priority,joinedAt,status,reminderMinutes,reminderSentAt,reminderDismissed) VALUES (?,?,?,?,?,?,?, ?,?,?)").run('e','q','u',1,'medium','2026-09-29','waiting',15,'2026-09-29T09:30:00',1)
      db.close()
      const reopened = openDatabase(file)
      try {
        expect(reopened.prepare('SELECT reminderMinutes,reminderSentAt,reminderDismissed FROM QueueEntry').get()).toMatchObject({ reminderMinutes: 15, reminderSentAt: '2026-09-29T09:30:00', reminderDismissed: 1 })
      } finally { reopened.close() }
    } finally { if (db.isOpen) db.close(); fs.rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('reminder endpoints', () => {
  it('reevaluates immediately when staff shorten the expected service duration', async () => {
    const admin = await cookieFor(app, 'a1')
    expect(reminderNotes('u3')).toHaveLength(0)
    expect((await request(app).put('/api/services/s1').set('Cookie', admin).send({ expectedDuration: 10 })).status).toBe(200)
    expect(reminderNotes('u3')).toHaveLength(1)
    expect(getQueue('s1')[1].reminderWaitMinutes).toBe(10)
  })

  it('allows only the authenticated owner to update and dismiss their reminder', async () => {
    const own = await cookieFor(app, 'u1'); const staff = await cookieFor(app, 'a1')
    const path = '/api/queues/s1/reminder'
    expect((await request(app).put(path).send({ entryId: 'q3', reminderMinutes: 5 })).status).toBe(401)
    expect((await request(app).put(path).set('Cookie', staff).send({ entryId: 'q3', reminderMinutes: 5 })).status).toBe(403)
    expect((await request(app).put(path).set('Cookie', own).send({ entryId: 'q3', reminderMinutes: 7 })).status).toBe(400)
    expect((await request(app).put(path).set('Cookie', own).send({ reminderMinutes: 5 })).status).toBe(400)
    expect((await request(app).put(path).set('Cookie', own).send({ entryId: 'old-visit', reminderMinutes: 5 })).status).toBe(409)
    at('10:00:00')
    const saved = await request(app).put(path).set('Cookie', own).send({ entryId: 'q3', reminderMinutes: 15 })
    expect(saved.body).toMatchObject({ userId: 'u1', reminderMinutes: 15 })
    expect((await request(app).post(path+'/dismiss').set('Cookie', own).send({ notificationId: saved.body.reminderNotificationId })).status).toBe(200)
    expect((await request(app).post('/api/queues/s2/reminder/dismiss').set('Cookie', own).send({ notificationId: saved.body.reminderNotificationId })).status).toBe(404)
  })
})

describe('background worker', () => {
  it('checks at startup, checks every thirty seconds without browser requests, and stops cleanly', () => {
    vi.useFakeTimers()
    const check = vi.fn()
    const stop = startReminderWorker(check)
    expect(check).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(REMINDER_CHECK_MS * 2)
    expect(check).toHaveBeenCalledTimes(3)
    stop(); vi.advanceTimersByTime(REMINDER_CHECK_MS)
    expect(check).toHaveBeenCalledTimes(3)
  })

  it('retries on the next tick after a failed check', () => {
    vi.useFakeTimers(); vi.spyOn(console, 'error').mockImplementation(() => {})
    const check = vi.fn().mockImplementationOnce(() => { throw new Error('busy') }).mockReturnValue(0)
    const stop = startReminderWorker(check)
    vi.advanceTimersByTime(REMINDER_CHECK_MS)
    expect(check).toHaveBeenCalledTimes(2)
    stop()
  })
})
