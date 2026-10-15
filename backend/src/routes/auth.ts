import { Router } from 'express'
import { login, register } from '../modules/auth.ts'

export const authRouter = Router()

authRouter.post('/register', (req, res) => {
  res.status(201).json(register(req.body))
})

authRouter.post('/login', (req, res) => {
  res.json(login(req.body))
})
