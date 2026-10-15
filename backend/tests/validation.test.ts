import { describe, expect, it } from 'vitest'
import { HttpError } from '../src/errors.ts'
import { assertValid, validate } from '../src/validation.ts'
import type { Schema } from '../src/validation.ts'

const schema: Schema = {
  name: { type: 'string', required: true, min: 2, max: 5 },
  count: { type: 'number', required: true, integer: true, min: 1, max: 10 },
  level: { type: 'string', oneOf: ['low', 'high'] },
  active: { type: 'boolean' },
}

describe('validate', () => {
  it('accepts a valid body', () => {
    expect(validate({ name: 'abc', count: 3, level: 'low', active: true }, schema)).toEqual({})
  })

  it('reports missing required fields', () => {
    expect(validate({}, schema)).toEqual({ name: 'name is required.', count: 'count is required.' })
  })

  it('treats a non-object body as empty', () => {
    expect(Object.keys(validate('nope', schema))).toEqual(['name', 'count'])
  })

  it('rejects blank strings for required fields', () => {
    expect(validate({ name: '   ', count: 1 }, schema).name).toBe('name is required.')
  })

  it('checks field types', () => {
    const errors = validate({ name: 5, count: '3', active: 'yes' }, schema)
    expect(errors.name).toBe('name must be a string.')
    expect(errors.count).toBe('count must be a number.')
    expect(errors.active).toBe('active must be true or false.')
  })

  it('checks string length limits', () => {
    expect(validate({ name: 'a', count: 1 }, schema).name).toMatch(/at least 2/)
    expect(validate({ name: 'abcdef', count: 1 }, schema).name).toMatch(/at most 5/)
  })

  it('checks number limits and whole numbers', () => {
    expect(validate({ name: 'abc', count: 0 }, schema).count).toMatch(/at least 1/)
    expect(validate({ name: 'abc', count: 11 }, schema).count).toMatch(/at most 10/)
    expect(validate({ name: 'abc', count: 2.5 }, schema).count).toMatch(/whole number/)
  })

  it('checks allowed values', () => {
    expect(validate({ name: 'abc', count: 1, level: 'mid' }, schema).level).toMatch(/one of/)
  })

  it('skips missing fields in partial mode but still checks given ones', () => {
    expect(validate({}, schema, true)).toEqual({})
    expect(validate({ count: 'x' }, schema, true)).toEqual({ count: 'count must be a number.' })
  })

  it('runs custom checks on strings', () => {
    const custom: Schema = { code: { type: 'string', check: (v) => (v === 'ok' ? undefined : 'bad code') } }
    expect(validate({ code: 'ok' }, custom)).toEqual({})
    expect(validate({ code: 'no' }, custom)).toEqual({ code: 'bad code' })
  })
})

describe('assertValid', () => {
  it('throws a 400 with field errors', () => {
    try {
      assertValid({}, schema)
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
      expect((err as HttpError).status).toBe(400)
      expect((err as HttpError).fields?.name).toBeDefined()
    }
  })

  it('does nothing for a valid body', () => {
    expect(() => assertValid({ name: 'abc', count: 2 }, schema)).not.toThrow()
  })
})
