import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { HttpError } from './errors.ts'

export function createApp() {
  const app = express()
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, fields: err.fields })
      return
    }
    // express.json() throws a 400 for malformed bodies
    if (typeof err === 'object' && err !== null && 'status' in err && err.status === 400) {
      res.status(400).json({ error: 'Malformed JSON body' })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  })

  return app
}
