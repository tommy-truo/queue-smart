import { Router } from 'express'
import { requireRole } from '../middleware.ts'
import { getQueue, queueSummary } from '../modules/queue.ts'
import { createService, listServices, updateService } from '../modules/services.ts'

import { sendDueReminders } from '../modules/reminders.ts'
import { transaction } from '../transaction.ts'

export const servicesRouter = Router()

servicesRouter.get('/', requireRole(), (_req, res) => {
  res.json(listServices().map((service) => ({ ...service, ...queueSummary(service) })))
})

servicesRouter.post('/', requireRole('admin'), (req, res) => {
  res.status(201).json(createService(req.body))
})

servicesRouter.put('/:id', requireRole('admin'), (req, res) => {
  const service = transaction(() => {
    const updated = updateService(String(req.params.id), req.body)
    if (req.body.expectedDuration !== undefined) {
      sendDueReminders(updated, getQueue(updated.id))
    }
    return updated
  })
  res.json(service)
})
