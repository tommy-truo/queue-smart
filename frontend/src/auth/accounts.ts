import type { Role } from './AuthContext.ts'
import { normalizeEmail, normalizeMiddleInitial } from './validateAuth.ts'

export type StoredAccount = {
  email: string
  password: string
  firstName: string
  lastName: string
  middleInitial: string | null
  role: Role
}

export type SessionUser = Omit<StoredAccount, 'password'>

export type RegisterInput = {
  firstName: string
  lastName: string
  middleInitial: string
  email: string
  password: string
  confirmPassword: string
}

const REGISTERED_KEY = 'queuesmart.registeredAccounts'

const SEED_ACCOUNTS: StoredAccount[] = [
  {
    email: 'alex.kim@example.com',
    password: 'UserPass1',
    firstName: 'Alex',
    lastName: 'Kim',
    middleInitial: null,
    role: 'user',
  },
  {
    email: 'admin@queuesmart.local',
    password: 'AdminPass1',
    firstName: 'Admin',
    lastName: 'User',
    middleInitial: null,
    role: 'admin',
  },
  {
    email: 'employee@queuesmart.local',
    password: 'EmployeePass1',
    firstName: 'Employee',
    lastName: 'User',
    middleInitial: null,
    role: 'employee',
  },
]

function loadRegisteredAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(REGISTERED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredAccount[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function saveRegisteredAccounts(accounts: StoredAccount[]): void {
  localStorage.setItem(REGISTERED_KEY, JSON.stringify(accounts))
}

export function getAllAccounts(): StoredAccount[] {
  return [...SEED_ACCOUNTS, ...loadRegisteredAccounts()]
}

export function findAccountByEmail(email: string): StoredAccount | undefined {
  const normalized = normalizeEmail(email)
  return getAllAccounts().find((account) => account.email === normalized)
}

export function isEmailTaken(email: string): boolean {
  return findAccountByEmail(email) !== undefined
}

export function toSessionUser(account: StoredAccount): SessionUser {
  const { password: _password, ...user } = account
  return user
}

export function verifyCredentials(email: string, password: string): StoredAccount | null {
  const account = findAccountByEmail(email)
  if (!account || account.password !== password) return null
  return account
}

export function saveRegisteredAccount(input: RegisterInput): StoredAccount {
  const account: StoredAccount = {
    email: normalizeEmail(input.email),
    password: input.password,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    middleInitial: normalizeMiddleInitial(input.middleInitial),
    role: 'user',
  }
  const registered = loadRegisteredAccounts()
  registered.push(account)
  saveRegisteredAccounts(registered)
  return account
}
