import { createHash } from 'node:crypto'
import request from 'supertest'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.ts'
import { getDb, resetDatabase } from '../src/db.ts'
import { SESSION_TTL } from '../src/sessions.ts'
import { cookieFor } from './sessionHelper.ts'

const app = createApp()
beforeEach(resetDatabase)
afterEach(() => vi.unstubAllEnvs())

describe('server sessions', () => {
  it('never authenticates a caller-supplied user id or forged token', async () => {
    for (const headers of [{ 'x-user-id': 'a1' }, { Cookie: 'queuesmart_session=bad' }, { Cookie: `queuesmart_session=${'a'.repeat(64)}` }]) {
      expect((await request(app).get('/api/reports/services').set(headers)).status).toBe(401)
    }
  })

  it('uses an HttpOnly SameSite cookie and stores only a token hash', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@queuesmart.local', password: 'AdminPass1' })
    expect(res.status).toBe(200)
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find(c => /^queuesmart_session=[a-f0-9]{64};/.test(c))!
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Path=/api')
    const token = cookie.split(';')[0]!.split('=')[1]!
    const row = getDb().prepare('SELECT * FROM Session').get() as { tokenHash: string; userId: string; expiresAt: number }
    expect(row.tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(row.tokenHash).not.toBe(token)
    expect(row.userId).toBe('a1')
    expect(row.expiresAt).toBeGreaterThan(Date.now() + SESSION_TTL - 5000)
    expect((await request(app).get('/api/auth/session').set('Cookie', cookie.split(';')[0]!)).body.role).toBe('admin')
    expect(res.body).not.toHaveProperty('tokenHash')
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('uses Secure cookies in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@queuesmart.local', password: 'AdminPass1' })
    expect((res.headers['set-cookie'] as unknown as string[]).some(c => c.includes('Secure'))).toBe(true)
  })

  it('rejects expired sessions and removes them on the next login', async () => {
    const cookie = await cookieFor(app, 'a1')
    getDb().prepare('UPDATE Session SET expiresAt = ?').run(Date.now() - 1)
    expect((await request(app).get('/api/services').set('Cookie', cookie)).status).toBe(401)
    await cookieFor(app, 'u1')
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM Session').get()).toMatchObject({ n: 1 })
  })

  it('revokes logout and rotates the previous browser session on login', async () => {
    const first = await cookieFor(app, 'a1')
    const replacement = await request(app).post('/api/auth/login').set('Cookie', first).send({ email: 'employee@queuesmart.local', password: 'EmployeePass1' })
    const second = (replacement.headers['set-cookie'] as unknown as string[]).find(c => /^queuesmart_session=[a-f0-9]{64};/.test(c))!.split(';')[0]!
    expect((await request(app).get('/api/services').set('Cookie', first)).status).toBe(401)
    expect((await request(app).get('/api/auth/session').set('Cookie', second)).body.role).toBe('employee')
    const logout = await request(app).post('/api/auth/logout').set('Cookie', second)
    expect(logout.status).toBe(204)
    expect((await request(app).get('/api/services').set('Cookie', second)).status).toBe(401)
    expect((await request(app).post('/api/auth/logout')).status).toBe(204)
  })

  it('establishes a session when registering', async () => {
    const agent = request.agent(app)
    expect((await agent.post('/api/auth/register').send({ fullName: 'Session Tester', email: 'session@example.com', password: 'Secret123' })).status).toBe(201)
    expect((await agent.get('/api/auth/session')).body.email).toBe('session@example.com')
  })

  it('preserves the previous session and account data when creating the new session fails', async () => {
    const cookie = await cookieFor(app, 'a1')
    getDb().exec("CREATE TRIGGER reject_session BEFORE INSERT ON Session BEGIN SELECT RAISE(ABORT, 'session failed'); END")
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await request(app).post('/api/auth/register').set('Cookie', cookie).send({ fullName: 'Session Rollback', email: 'session-rollback@example.com', password: 'Secret123' })
      expect(res.status).toBe(500)
      expect(res.headers['set-cookie']).toBeUndefined()
      expect(getDb().prepare('SELECT 1 FROM UserCredentials WHERE email = ?').get('session-rollback@example.com')).toBeUndefined()
      expect((await request(app).get('/api/auth/session').set('Cookie', cookie)).body.id).toBe('a1')
    } finally { getDb().exec('DROP TRIGGER reject_session'); quiet.mockRestore() }
  })

  it('rolls registration back when profile persistence fails', async () => {
    getDb().exec("CREATE TRIGGER reject_profile BEFORE INSERT ON UserProfile BEGIN SELECT RAISE(ABORT, 'profile failed'); END")
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await request(app).post('/api/auth/register').send({ fullName: 'Rollback Tester', email: 'rollback@example.com', password: 'Secret123' })
      expect(res.status).toBe(500)
      expect(getDb().prepare('SELECT 1 FROM UserCredentials WHERE email = ?').get('rollback@example.com')).toBeUndefined()
      expect(getDb().prepare('SELECT 1 FROM Session').get()).toBeUndefined()
    } finally { getDb().exec('DROP TRIGGER reject_profile'); quiet.mockRestore() }
    expect((await request(app).post('/api/auth/register').send({ fullName: 'Rollback Tester', email: 'rollback@example.com', password: 'Secret123' })).status).toBe(201)
  })
})

describe('cross-site mutation protection', () => {
  it('rejects foreign origins and cross-site browser requests before mutation', async () => {
    const cookie = await cookieFor(app, 'a1')
    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie).set('Origin', 'https://attacker.example')).status).toBe(403)
    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie).set('Sec-Fetch-Site', 'cross-site')).status).toBe(403)
    expect((await request(app).get('/api/auth/session').set('Cookie', cookie)).status).toBe(200)
    expect((await request(app).post('/api/auth/logout').set('Host', 'queuesmart.test').set('Origin', 'http://queuesmart.test').set('Cookie', cookie)).status).toBe(204)
  })

  it('supports an explicitly configured app origin behind a proxy', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://queue.example')
    expect((await request(app).post('/api/auth/logout').set('Origin', 'https://queue.example')).status).toBe(204)
    expect((await request(app).post('/api/auth/logout').set('Origin', 'https://other.example')).status).toBe(403)
  })
})

describe('priority endpoint authorization', () => {
  it('reserves priority assignment for staff and keeps customer joins at medium', async () => {
    const user = await cookieFor(app, 'u1')
    const employee = await cookieFor(app, 'e1')
    const admin = await cookieFor(app, 'a1')
    for (const priority of ['high', 'low']) {
      expect((await request(app).post('/api/queues/s3/join').set('Cookie', user).send({ priority })).status).toBe(400)
    }
    const joined = await request(app).post('/api/queues/s3/join').set('Cookie', user).send({})
    expect(joined.body.priority).toBe('medium')
    const path = `/api/queues/s3/entries/${joined.body.id}/priority`
    expect((await request(app).post(path).set('Cookie', user).send({ priority: 'high' })).status).toBe(403)
    expect((await request(app).post(path).set('Cookie', employee).send({ priority: 'high' })).body).toMatchObject({ priority: 'high', position: 1 })
    expect((await request(app).post(path).set('Cookie', admin).send({ priority: 'low' })).body.priority).toBe('low')
  })
})
