import { Router } from 'express'
import { login, register } from '../modules/auth.ts'
import { currentUser, requireRole } from '../middleware.ts'
import { endSession, startSession } from '../sessions.ts'
import { transaction } from '../transaction.ts'

export const authRouter = Router()

authRouter.post('/register', (req, res) => {
  const account = transaction(() => {
    const user = register(req.body)
    startSession(user.id, req, res)
    return user
  })
  res.status(201).json(account)
})

authRouter.post('/login', (req, res) => {
  const account = login(req.body)
  transaction(() => startSession(account.id, req, res))
  res.json(account)
})

authRouter.get('/session', requireRole(), (_req, res) => {
  res.json(currentUser(res))
})

authRouter.post('/logout', (req, res) => {
  endSession(req, res)
  res.status(204).end()
})
