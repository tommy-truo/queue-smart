import { resetDatabase } from './db.ts'

let counter = 0

export function nextId(prefix: string): string {
  counter += 1
  return `${prefix}${counter}-${Date.now().toString(36)}`
}

/** Puts the seed data back. Used by tests so each one starts fresh. */
export function resetStore(): void {
  resetDatabase()
}
