import { Router } from 'express'
import { currentUser, requireRole } from '../middleware.ts'
import { getQueue, joinQueue, leaveQueue, myQueues, removeFromQueue, requeue, serveNext } from '../modules/queue.ts'

export const queuesRouter = Router()

queuesRouter.get('/mine', requireRole('user'), (_req, res) => {
  res.json(myQueues(currentUser(res).id))
})

queuesRouter.get('/:serviceId', requireRole('admin', 'employee'), (req, res) => {
  res.json(getQueue(String(req.params.serviceId)))
})

queuesRouter.post('/:serviceId/join', requireRole('user'), (req, res) => {
  res.status(201).json(joinQueue(currentUser(res), String(req.params.serviceId), req.body))
})

queuesRouter.post('/:serviceId/leave', requireRole('user'), (req, res) => {
  res.json(leaveQueue(currentUser(res), String(req.params.serviceId)))
})

queuesRouter.post('/:serviceId/serve-next', requireRole('admin', 'employee'), (req, res) => {
  res.json(serveNext(String(req.params.serviceId)))
})

queuesRouter.post('/:serviceId/requeue', requireRole('admin', 'employee'), (req, res) => {
  res.json(requeue(String(req.params.serviceId)))
})

queuesRouter.post('/:serviceId/entries/:entryId/remove', requireRole('admin', 'employee'), (req, res) => {
  res.json(removeFromQueue(String(req.params.serviceId), String(req.params.entryId)))
})
