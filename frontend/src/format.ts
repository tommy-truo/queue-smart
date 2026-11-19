// One place for how dates, times and stored values are shown.

/** "Nov 17, 2026". Takes a full timestamp or a plain YYYY-MM-DD day. */
export function formatDate(value: string): string {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  // A plain day would be read as midnight UTC, which is the day before in US time zones.
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "3:54 PM". */
export function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** "Nov 19, 2026, 3:54 PM". */
export function formatDateTime(value: string): string {
  return `${formatDate(value)}, ${formatTime(value)}`
}

/** Stored values like "high" or "served" shown as "High" or "Served". */
export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
