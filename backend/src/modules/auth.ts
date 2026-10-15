import { HttpError } from '../errors.ts'
import { db, nextId } from '../store.ts'
import type { PublicUser, User } from '../types.ts'
import { assertValid } from '../validation.ts'
import type { Schema } from '../validation.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_PATTERN = /^[A-Za-z][A-Za-z' -]*$/

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

export const registerSchema: Schema = {
  fullName: { type: 'string', required: true, max: 50, check: checkName },
  email: { type: 'string', required: true, max: 254, check: checkEmail },
  password: { type: 'string', required: true, min: 8, max: 64, check: checkPassword },
}

export const loginSchema: Schema = {
  email: { type: 'string', required: true, max: 254 },
  password: { type: 'string', required: true, max: 64 },
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function toPublicUser(user: User): PublicUser {
  const { password: _password, ...rest } = user
  return rest
}

export function findUserById(id: string): User | undefined {
  return db.users.find((user) => user.id === id)
}

export function register(body: unknown): PublicUser {
  assertValid(body, registerSchema)
  const { fullName, email, password } = body as { fullName: string; email: string; password: string }

  const normalized = normalizeEmail(email)
  if (db.users.some((user) => user.email === normalized)) {
    throw new HttpError(409, 'An account with this email already exists.', { email: 'Email is already registered.' })
  }

  // Registration always creates a regular user; admins and employees are seeded.
  const user: User = { id: nextId('u'), email: normalized, password, fullName: fullName.trim(), role: 'user' }
  db.users.push(user)
  return toPublicUser(user)
}

export function login(body: unknown): PublicUser {
  assertValid(body, loginSchema)
  const { email, password } = body as { email: string; password: string }

  const user = db.users.find((u) => u.email === normalizeEmail(email))
  if (!user || user.password !== password) {
    throw new HttpError(401, 'Invalid email or password.')
  }
  return toPublicUser(user)
}
