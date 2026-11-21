import { Router } from 'express'
import { requireRole } from '../middleware.ts'
import { suggestJoinTimes } from '../modules/suggestions.ts'

export const suggestionsRouter = Router()

suggestionsRouter.get('/', requireRole('user'), (req, res) => {
  res.json(suggestJoinTimes(req.query))
})
