import type { DatabaseSync } from 'node:sqlite'
import { getDb } from './db.ts'

let sequence = 0

/** Savepoints make synchronous mutations atomic, including calls inside another transaction. */
export function withTransaction<T>(database: DatabaseSync, fn: () => T): T {
  const savepoint = `queuesmart_${++sequence}`
  database.exec(`SAVEPOINT ${savepoint}`)
  try {
    const result = fn()
    database.exec(`RELEASE SAVEPOINT ${savepoint}`)
    return result
  } catch (error) {
    database.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    database.exec(`RELEASE SAVEPOINT ${savepoint}`)
    throw error
  }
}

export function transaction<T>(fn: () => T): T {
  return withTransaction(getDb(), fn)
}
