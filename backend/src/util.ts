let counter = 0

export function nextId(prefix: string): string {
  counter += 1
  return `${prefix}${counter}-${Date.now().toString(36)}`
}

/** The current local wall-clock time with no time zone, the same format the seed data uses. */
export function localTimestamp(now = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 19)
}
