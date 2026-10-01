/** Format elapsed milliseconds for queue wait display (minutes, no seconds). */
export function formatWaitDuration(ms: number): string {
  if (ms < 0) ms = 0
  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 1) return '0 min'
  if (totalMinutes < 60) return `${totalMinutes} min`

  const totalHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (totalHours < 24) {
    return minutes > 0 ? `${totalHours} h ${minutes} min` : `${totalHours} h`
  }

  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours > 0 ? `${days} d ${hours} h` : `${days} d`
}

export function waitSince(joinedAt: string, nowMs: number): string {
  return formatWaitDuration(nowMs - new Date(joinedAt).getTime())
}
