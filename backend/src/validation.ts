import { HttpError } from './errors.ts'
import type { FieldErrors } from './errors.ts'

type Rule = {
  type: 'string' | 'number' | 'boolean'
  required?: boolean
  /** Min/max length for strings, min/max value for numbers. */
  min?: number
  max?: number
  integer?: boolean
  oneOf?: readonly string[]
  /** Extra check that returns an error message, or undefined if the value is fine. */
  check?: (value: string) => string | undefined
}

export type Schema = Record<string, Rule>

function checkField(field: string, value: unknown, rule: Rule): string | undefined {
  if (rule.type === 'string') {
    if (typeof value !== 'string') return `${field} must be a string.`
    const length = value.trim().length
    if (rule.required && length === 0) return `${field} is required.`
    if (rule.min !== undefined && length < rule.min) return `${field} must be at least ${rule.min} characters.`
    if (rule.max !== undefined && length > rule.max) return `${field} must be at most ${rule.max} characters.`
    if (rule.oneOf && !rule.oneOf.includes(value)) return `${field} must be one of: ${rule.oneOf.join(', ')}.`
    return rule.check?.(value)
  }
  if (rule.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${field} must be a number.`
    if (rule.integer && !Number.isInteger(value)) return `${field} must be a whole number.`
    if (rule.min !== undefined && value < rule.min) return `${field} must be at least ${rule.min}.`
    if (rule.max !== undefined && value > rule.max) return `${field} must be at most ${rule.max}.`
    return undefined
  }
  if (typeof value !== 'boolean') return `${field} must be true or false.`
  return undefined
}

/**
 * Checks `body` against `schema` and returns an error message per invalid field.
 * With `partial`, missing fields are allowed (used for updates).
 */
export function validate(body: unknown, schema: Schema, partial = false): FieldErrors {
  const errors: FieldErrors = {}
  const data = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field]
    if (value === undefined || value === null) {
      if (rule.required && !partial) errors[field] = `${field} is required.`
      continue
    }
    const error = checkField(field, value, rule)
    if (error) errors[field] = error
  }
  return errors
}

/** Throws a 400 if the body does not match the schema. */
export function assertValid(body: unknown, schema: Schema, partial = false): void {
  const errors = validate(body, schema, partial)
  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, 'Invalid input', errors)
  }
}
