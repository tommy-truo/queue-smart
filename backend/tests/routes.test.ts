import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.ts'
import { resetStore } from '../src/store.ts'

const app = createApp()

beforeEach(() => {
  resetStore()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('auth routes', () => {
  it('registers and then logs in', async () => {
    const body = { fullName: 'Taylor Smith', email: 'taylor@example.com', password: 'Secret123' }
    const registered = await request(app).post('/api/auth/register').send(body)
    expect(registered.status).toBe(201)

    const loggedIn = await request(app).post('/api/auth/login').send({ email: body.email, password: body.password })
    expect(loggedIn.status).toBe(200)
    expect(loggedIn.body.id).toBe(registered.body.id)
  })

  it('returns field errors for invalid input', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'bad' })
    expect(res.status).toBe(400)
    expect(Object.keys(res.body.fields)).toEqual(['fullName', 'email', 'password'])
  })

  it('returns 401 for bad credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alex.kim@example.com', password: 'nope' })
    expect(res.status).toBe(401)
  })
})

describe('role handling', () => {
  it('requires a signed-in user', async () => {
    expect((await request(app).get('/api/services')).status).toBe(401)
    expect((await request(app).get('/api/services').set('x-user-id', 'unknown')).status).toBe(401)
  })

  it('blocks users from admin actions', async () => {
    const res = await request(app).post('/api/services').set('x-user-id', 'u1').send({})
    expect(res.status).toBe(403)
  })

  it('blocks admins from joining queues', async () => {
    const res = await request(app).post('/api/queues/s3/join').set('x-user-id', 'a1')
    expect(res.status).toBe(403)
  })
})

describe('service routes', () => {
  it('lists services with queue length and wait', async () => {
    const res = await request(app).get('/api/services').set('x-user-id', 'u1')
    expect(res.status).toBe(200)
    expect(res.body[0]).toMatchObject({ id: 's1', queueLength: 3, estimatedWait: 45 })
  })

  it('lets admins create and update services', async () => {
    const created = await request(app)
      .post('/api/services')
      .set('x-user-id', 'a1')
      .send({ name: 'Library Help', description: 'Holds and renewals.', expectedDuration: 5, priority: 'low' })
    expect(created.status).toBe(201)

    const updated = await request(app).put(`/api/services/${created.body.id}`).set('x-user-id', 'a1').send({ open: false })
    expect(updated.body.open).toBe(false)
  })

  it('returns 404 for an unknown service', async () => {
    const res = await request(app).put('/api/services/missing').set('x-user-id', 'a1').send({})
    expect(res.status).toBe(404)
  })
})

describe('queue routes', () => {
  it('lets a user join, check status and leave', async () => {
    const joined = await request(app).post('/api/queues/s3/join').set('x-user-id', 'u1').send({})
    expect(joined.status).toBe(201)
    expect(joined.body.position).toBe(3)

    const mine = await request(app).get('/api/queues/mine').set('x-user-id', 'u1')
    expect(mine.body.map((e: { serviceId: string }) => e.serviceId).sort()).toEqual(['s1', 's3'])

    const left = await request(app).post('/api/queues/s3/leave').set('x-user-id', 'u1')
    expect(left.body.outcome).toBe('left')
  })

  it('returns 409 when joining a closed service', async () => {
    const res = await request(app).post('/api/queues/s4/join').set('x-user-id', 'u1')
    expect(res.status).toBe(409)
  })

  it('lets staff view the queue and serve the next person', async () => {
    const queue = await request(app).get('/api/queues/s1').set('x-user-id', 'e1')
    expect(queue.body).toHaveLength(3)

    const served = await request(app).post('/api/queues/s1/serve-next').set('x-user-id', 'a1')
    expect(served.body.served.userName).toBe('Jordan Lee')
    expect(served.body.nowServing.userName).toBe('Sam Patel')
  })

  it('lets staff remove someone from the line', async () => {
    const removed = await request(app).post('/api/queues/s1/entries/q3/remove').set('x-user-id', 'e1')
    expect(removed.status).toBe(200)
    expect(removed.body).toMatchObject({ id: 'q3', outcome: 'removed', status: 'waiting' })

    const queue = await request(app).get('/api/queues/s1').set('x-user-id', 'a1')
    expect(queue.body.map((entry: { id: string }) => entry.id)).toEqual(['q1', 'q2'])
  })

  it('blocks users from removing people and rejects someone already gone', async () => {
    const forbidden = await request(app).post('/api/queues/s1/entries/q3/remove').set('x-user-id', 'u1')
    expect(forbidden.status).toBe(403)

    await request(app).post('/api/queues/s1/entries/q3/remove').set('x-user-id', 'a1')
    const again = await request(app).post('/api/queues/s1/entries/q3/remove').set('x-user-id', 'a1')
    expect(again.status).toBe(404)
  })
})

describe('me routes', () => {
  it('returns the user notifications and history', async () => {
    const notifications = await request(app).get('/api/me/notifications').set('x-user-id', 'u1')
    expect(notifications.body).toHaveLength(2)

    const history = await request(app).get('/api/me/history').set('x-user-id', 'u1')
    expect(history.body[0]).toMatchObject({ date: '2026-09-22', outcome: 'served' })
  })
})
