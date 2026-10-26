import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../src/password.ts'

describe('password hashing', () => {
  it('does not store the plain password', () => {
    expect(hashPassword('UserPass1')).not.toContain('UserPass1')
  })

  it('verifies the right password and rejects a wrong one', () => {
    const stored = hashPassword('UserPass1')
    expect(verifyPassword('UserPass1', stored)).toBe(true)
    expect(verifyPassword('userpass1', stored)).toBe(false)
  })

  it('uses a different salt each time', () => {
    expect(hashPassword('UserPass1')).not.toBe(hashPassword('UserPass1'))
  })

  it('rejects a malformed stored value', () => {
    expect(verifyPassword('UserPass1', 'nonsense')).toBe(false)
  })
})
