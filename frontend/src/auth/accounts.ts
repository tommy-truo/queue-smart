import type { Role } from './AuthContext.ts'
import { normalizeEmail } from './validateAuth.ts'

export type StoredAccount = {
  email: string
  password: string
  fullName: string
  role: Role
  id: string
}

export type SessionUser = Omit<StoredAccount, 'password'>

export type RegisterInput = {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

const REGISTERED_KEY = 'queuesmart.registeredAccounts'

const SEED_ACCOUNTS: StoredAccount[] = [
  {
    email: 'alex.kim@example.com',
    password: 'UserPass1',
    fullName: 'Alex Kim',
    role: 'user',
    id: 'u1',
  },
  {
    email: 'admin@queuesmart.local',
    password: 'AdminPass1',
    fullName: 'Admin User',
    role: 'admin',
    id: 'a1',
  },
  {
    email: 'employee@queuesmart.local',
    password: 'EmployeePass1',
    fullName: 'Employee User',
    role: 'employee',
    id: 'e1',
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

export function isUser(account: StoredAccount): boolean{
  return account.role === 'user';
}

export function saveRegisteredAccount(input: RegisterInput): StoredAccount {
  let accounts = [...SEED_ACCOUNTS].sort((a, b)=> a.id === b.id ? 0:(a.id < b.id ? -1:1));
  const account: StoredAccount = {
    email: normalizeEmail(input.email),
    password: input.password,
    fullName: input.fullName.trim(),
    role: 'user',
    id: 'u' + (Number(accounts.findLast(isUser)?.id.at(-1)) + 1),
  }
  const registered = loadRegisteredAccounts()
  registered.push(account)
  saveRegisteredAccounts(registered)
  return account
}
