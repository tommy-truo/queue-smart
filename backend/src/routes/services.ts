import { Router } from 'express'
import { requireRole } from '../middleware.ts'
import { queueSummary } from '../modules/queue.ts'
import { createService, listServices, updateService } from '../modules/services.ts'

export const servicesRouter = Router()

servicesRouter.get('/', requireRole(), (_req, res) => {
  res.json(listServices().map((service) => ({ ...service, ...queueSummary(service) })))
})

servicesRouter.post('/', requireRole('admin'), (req, res) => {
  res.status(201).json(createService(req.body))
})

servicesRouter.put('/:id', requireRole('admin'), (req, res) => {
  res.json(updateService(String(req.params.id), req.body))
})
