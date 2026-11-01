import { getDb } from '../db.ts'
import { HttpError } from '../errors.ts'
import { nextId } from '../store.ts'
import type { Priority, Service } from '../types.ts'
import { assertValid } from '../validation.ts'
import type { Schema } from '../validation.ts'

export const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high']

export const serviceSchema: Schema = {
  name: { type: 'string', required: true, max: 100 },
  description: { type: 'string', required: true, max: 500 },
  expectedDuration: { type: 'number', required: true, integer: true, min: 1, max: 480 },
  priority: { type: 'string', required: true, oneOf: PRIORITIES },
  notification: { type: 'string', required: false, max: 500 },
  open: { type: 'boolean' },
}

type ServiceRow = {
  serviceId: string
  name: string
  description: string
  expectedDuration: number
  priority: Priority
  notification: string | null
  open: number
}

function toService(row: ServiceRow): Service {
  return {
    id: row.serviceId,
    name: row.name,
    description: row.description,
    expectedDuration: row.expectedDuration,
    priority: row.priority,
    notification: row.notification ?? undefined,
    open: row.open === 1,
  }
}

function assertNameFree(name: string, exceptId?: string): void {
  const taken = getDb().prepare('SELECT 1 FROM Service WHERE name = ? AND serviceId != ?').get(name, exceptId ?? '')
  if (taken) throw new HttpError(409, 'A service with this name already exists.', { name: 'Name is already in use.' })
}

export function listServices(): Service[] {
  const rows = getDb().prepare('SELECT * FROM Service ORDER BY rowid').all() as ServiceRow[]
  return rows.map(toService)
}

export function getService(id: string): Service {
  const row = getDb().prepare('SELECT * FROM Service WHERE serviceId = ?').get(id) as ServiceRow | undefined
  if (!row) throw new HttpError(404, 'Service not found.')
  return toService(row)
}

export function createService(body: unknown): Service {
  assertValid(body, serviceSchema)
  const input = body as Omit<Service, 'id' | 'open'> & { open?: boolean }

  const service: Service = {
    id: nextId('s'),
    name: input.name.trim(),
    description: input.description.trim(),
    expectedDuration: input.expectedDuration,
    priority: input.priority,
    notification: input.notification?.trim(),
    open: input.open ?? true,
  }
  assertNameFree(service.name)
  getDb()
    .prepare(
      'INSERT INTO Service (serviceId, name, description, expectedDuration, priority, notification, open) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      service.id,
      service.name,
      service.description,
      service.expectedDuration,
      service.priority,
      service.notification ?? null,
      service.open ? 1 : 0,
    )
  return service
}

export function updateService(id: string, body: unknown): Service {
  const service = getService(id)
  assertValid(body, serviceSchema, true)
  const input = body as Partial<Service>

  if (input.name !== undefined) service.name = input.name.trim()
  if (input.description !== undefined) service.description = input.description.trim()
  if (input.expectedDuration !== undefined) service.expectedDuration = input.expectedDuration
  if (input.priority !== undefined) service.priority = input.priority
  if (input.notification !== undefined) service.notification = input.notification.trim()
  if (input.open !== undefined) service.open = input.open

  assertNameFree(service.name, id)
  getDb()
    .prepare(
      'UPDATE Service SET name = ?, description = ?, expectedDuration = ?, priority = ?, notification = ?, open = ? WHERE serviceId = ?',
    )
    .run(
      service.name,
      service.description,
      service.expectedDuration,
      service.priority,
      service.notification ?? null,
      service.open ? 1 : 0,
      id,
    )
  return service
}
