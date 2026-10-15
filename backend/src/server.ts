import { createApp } from './app.ts'

const PORT = Number(process.env.PORT) || 3940

createApp().listen(PORT, () => {
  console.log(`QueueSmart API listening on http://localhost:${PORT}`)
})
