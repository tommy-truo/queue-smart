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
  type CsvColumn,
  WAIT_BY_HOUR_COLUMNS,
  waitByHourReport,
} from '../modules/reports.ts'

export const reportsRouter = Router()

/** JSON by default; `?format=csv` downloads the same rows as a CSV file. */
function send(req: Request, res: Response, name: string, rows: object[], columns: CsvColumn[]): void {
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
  const filters = parseFilters(req.query)
  const rows = serviceActivityReport(filters)
  if (req.query.format === 'csv') {
    // The file also carries the chart's numbers, as a second section after a blank line.
    const byHour = toCsv(waitByHourReport(filters), WAIT_BY_HOUR_COLUMNS)
    const body = `${toCsv(rows, SERVICE_ACTIVITY_COLUMNS)}\nAverage wait by time of day\n${byHour}`
    res.type('text/csv').attachment('service-activity.csv').send(body)
    return
  }
  res.json(rows)
})

reportsRouter.get('/wait-by-hour', requireRole('admin'), (req, res) => {
  send(req, res, 'wait-by-hour', waitByHourReport(parseFilters(req.query)), WAIT_BY_HOUR_COLUMNS)
})
