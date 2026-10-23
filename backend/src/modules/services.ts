import { HttpError } from '../errors.ts'
import { db, nextId } from '../store.ts'
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

export function listServices(): Service[] {
  return db.services
}

export function getService(id: string): Service {
  const service = db.services.find((s) => s.id === id)
  if (!service) throw new HttpError(404, 'Service not found.')
  return service
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
  db.services.push(service)
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
  return service
}
