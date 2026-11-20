import request from 'supertest'
import type { Express } from 'express'

/** Exercise the actual login endpoint; role tests must carry real sessions. */
export async function cookieFor(app: Express, id: string): Promise<string> {
  const accounts: Record<string, [string, string]> = {
    u1: ['alex.kim@example.com', 'UserPass1'],
    u2: ['jordan.lee@example.com', 'UserPass1'],
    a1: ['admin@queuesmart.local', 'AdminPass1'],
    e1: ['employee@queuesmart.local', 'EmployeePass1'],
  }
  const [email, password] = accounts[id]!
  const response = await request(app).post('/api/auth/login').send({ email, password })
  if (response.status !== 200) throw new Error(`Test login failed: ${response.text}`)
  const cookies = response.headers['set-cookie'] as unknown as string[]
  return cookies.filter(cookie => /^queuesmart_session=[a-f0-9]{64};/.test(cookie)).map(cookie => cookie.split(';')[0]).join('; ')
}
