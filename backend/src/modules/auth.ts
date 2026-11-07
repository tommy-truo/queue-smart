import { HttpError } from '../errors.ts'
import { getDb } from '../db.ts'
import { hashPassword, verifyPassword } from '../password.ts'
import { nextId } from '../store.ts'
import type { Role, User } from '../types.ts'
import { assertValid } from '../validation.ts'
import type { Schema } from '../validation.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_PATTERN = /^[A-Za-z][A-Za-z' -]*$/
const PHONE_PATTERN = /^\+?1?[-. ]?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}$/

function checkEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim()) ? undefined : 'Enter a valid email address.'
}

function checkName(name: string) {
  return NAME_PATTERN.test(name.trim())
    ? undefined
    : 'Full name must start with a letter and contain only letters, spaces, hyphens, or apostrophes.'
}

function checkPassword(password: string) {
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.'
  if (!/\d/.test(password)) return 'Password must include at least one digit.'
  return undefined
}

function checkPhone(phone: string) {
  return PHONE_PATTERN.test(phone.trim()) ? undefined : 'Enter a vaild phone number'
}

export const registerSchema: Schema = {
  fullName: { type: 'string', required: true, max: 50, check: checkName },
  email: { type: 'string', required: true, max: 254, check: checkEmail },
  password: { type: 'string', required: true, min: 8, max: 64, check: checkPassword },
  phone: { type: 'string', required: false, min: 10, max: 17, check: checkPhone},
}

export const loginSchema: Schema = {
  email: { type: 'string', required: true, max: 254 },
  password: { type: 'string', required: true, max: 64 },
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

type UserRow = { userId: string; email: string; role: Role; fullName: string; passwordHash: string, phone: string}

const USER_QUERY = `
  SELECT c.userId, c.email, c.role, c.passwordHash, p.fullName
  FROM UserCredentials c JOIN UserProfile p ON p.userId = c.userId`

function toUser(row: UserRow): User {
  return { id: row.userId, email: row.email, fullName: row.fullName, role: row.role, phone: row.phone }
}

export function findUserById(id: string): User | undefined {
  const row = getDb().prepare(`${USER_QUERY} WHERE c.userId = ?`).get(id) as UserRow | undefined
  return row && toUser(row)
}

export function register(body: unknown): User {
  assertValid(body, registerSchema)
  const { fullName, email, password, phone } = body as { fullName: string; email: string; password: string; phone: string }

  const db = getDb()
  const normalized = normalizeEmail(email)
  if (db.prepare('SELECT 1 FROM UserCredentials WHERE email = ?').get(normalized)) {
    throw new HttpError(409, 'An account with this email already exists.', { email: 'Email is already registered.' })
  }

  // Registration always creates a regular user; admins and employees are seeded.
  const user: User = { id: nextId('u'), email: normalized, fullName: fullName.trim(), role: 'user', phone: phone }
  db.prepare('INSERT INTO UserCredentials (userId, email, passwordHash, role) VALUES (?, ?, ?, ?)').run(
    user.id,
    user.email,
    hashPassword(password),
    user.role,
  )
  db.prepare('INSERT INTO UserProfile (userId, fullName, email, phone) VALUES (?, ?, ?, ?)').run(
    user.id, 
    user.fullName, 
    user.email,
    user.phone ?? null
  )
  return user
}

export function login(body: unknown): User {
  assertValid(body, loginSchema)
  const { email, password } = body as { email: string; password: string }

  const row = getDb().prepare(`${USER_QUERY} WHERE c.email = ?`).get(normalizeEmail(email)) as UserRow | undefined
  if (!row || !verifyPassword(password, row.passwordHash)) {
    throw new HttpError(401, 'Invalid email or password.')
  }
  return toUser(row)
}
