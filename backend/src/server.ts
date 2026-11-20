import { createApp } from './app.ts'
import { startReminderWorker } from './reminderWorker.ts'

const PORT = Number(process.env.PORT) || 3940
let stopReminders = () => {}
const server = createApp().listen(PORT, () => {
  stopReminders = startReminderWorker()
  console.log(`QueueSmart API listening on http://localhost:${PORT}`)
})
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => { stopReminders(); server.close() })
}
