import { Router } from 'express'
import { currentUser, requireRole } from '../middleware.ts'
import { listHistory } from '../modules/history.ts'
import { listNotifications } from '../modules/notifications.ts'

export const meRouter = Router()

meRouter.get('/notifications', requireRole(), (_req, res) => {
  res.json(listNotifications(currentUser(res).id))
})

meRouter.get('/history', requireRole('user'), (_req, res) => {
  res.json(listHistory(currentUser(res).id))
})
