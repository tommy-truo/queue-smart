import { beforeEach, describe, expect, it } from 'vitest'
import { login, register } from '../src/modules/auth.ts'
import { resetStore } from '../src/store.ts'

const valid = { fullName: 'Taylor Smith', email: 'Taylor@Example.com', password: 'Secret123' }

beforeEach(resetStore)

describe('register', () => {
  it('creates a user account without exposing the password', () => {
    const user = register(valid)
    expect(user).toMatchObject({ fullName: 'Taylor Smith', email: 'taylor@example.com', role: 'user' })
    expect(user).not.toHaveProperty('password')
  })

  it('ignores a role in the request', () => {
    expect(register({ ...valid, role: 'admin' }).role).toBe('user')
  })

  it('rejects a duplicate email regardless of case', () => {
    register(valid)
    expect(() => register({ ...valid, email: 'TAYLOR@example.com' })).toThrow(/already exists/)
  })

  it('validates email format', () => {
    expect(() => register({ ...valid, email: 'not-an-email' })).toThrow('Invalid input')
  })

  it('validates the password policy', () => {
    for (const password of ['short1A', 'alllowercase1', 'ALLUPPERCASE1', 'NoDigitsHere']) {
      expect(() => register({ ...valid, password })).toThrow('Invalid input')
    }
  })

  it('validates the name', () => {
    expect(() => register({ ...valid, fullName: '1234' })).toThrow('Invalid input')
    expect(() => register({ ...valid, fullName: 'a'.repeat(51) })).toThrow('Invalid input')
  })
})

describe('login', () => {
  it('returns the user for correct credentials', () => {
    expect(login({ email: 'admin@queuesmart.local', password: 'AdminPass1' })).toMatchObject({
      id: 'a1',
      role: 'admin',
    })
  })

  it('rejects a wrong password', () => {
    expect(() => login({ email: 'admin@queuesmart.local', password: 'wrong' })).toThrow(/Invalid email or password/)
  })

  it('rejects an unknown email', () => {
    expect(() => login({ email: 'nobody@example.com', password: 'Whatever1' })).toThrow(/Invalid email or password/)
  })

  it('requires both fields', () => {
    expect(() => login({})).toThrow('Invalid input')
  })
})
