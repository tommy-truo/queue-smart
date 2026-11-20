import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { getDb } from './db.ts'

export const SESSION_COOKIE = 'queuesmart_session'
export const SESSION_TTL = 8 * 60 * 60 * 1000
const hash = (token: string) => createHash('sha256').update(token).digest('hex')

export function sessionToken(req: Request): string | undefined {
  const value = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1)
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined
}

export function sessionUserId(req: Request): string | undefined {
  const token = sessionToken(req)
  if (!token) return undefined
  const row = getDb().prepare('SELECT userId FROM Session WHERE tokenHash = ? AND expiresAt > ?').get(hash(token), Date.now()) as { userId: string } | undefined
  return row?.userId
}

function cookieOptions() {
  return { httpOnly: true, sameSite: 'strict' as const, secure: process.env.NODE_ENV === 'production', path: '/api' }
}

export function endSession(req: Request, res: Response): void {
  const token = sessionToken(req)
  if (token) getDb().prepare('DELETE FROM Session WHERE tokenHash = ?').run(hash(token))
  res.clearCookie(SESSION_COOKIE, cookieOptions())
}

export function startSession(userId: string, req: Request, res: Response): void {
  const previous = sessionToken(req)
  if (previous) getDb().prepare('DELETE FROM Session WHERE tokenHash = ?').run(hash(previous))
  const token = randomBytes(32).toString('hex')
  const db = getDb()
  db.prepare('DELETE FROM Session WHERE expiresAt <= ?').run(Date.now())
  db.prepare('INSERT INTO Session (tokenHash, userId, expiresAt) VALUES (?, ?, ?)').run(hash(token), userId, Date.now() + SESSION_TTL)
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL })
}
