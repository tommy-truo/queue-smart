import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireRole } from '../middleware.ts'
import {
  PARTICIPATION_COLUMNS,
  parseFilters,
  participationReport,
  SERVICE_ACTIVITY_COLUMNS,
  serviceActivityReport,
  toCsv,
} from '../modules/reports.ts'

export const reportsRouter = Router()

/** JSON by default; `?format=csv` downloads the same rows as a CSV file. */
function send(req: Request, res: Response, name: string, rows: object[], columns: string[]): void {
  if (req.query.format === 'csv') {
    res.type('text/csv').attachment(`${name}.csv`).send(toCsv(rows, columns))
    return
  }
  res.json(rows)
}

reportsRouter.get('/participation', requireRole('admin'), (req, res) => {
  send(req, res, 'participation', participationReport(parseFilters(req.query)), PARTICIPATION_COLUMNS)
})

reportsRouter.get('/services', requireRole('admin'), (req, res) => {
  send(req, res, 'service-activity', serviceActivityReport(parseFilters(req.query)), SERVICE_ACTIVITY_COLUMNS)
})
