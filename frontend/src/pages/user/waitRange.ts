/** Wait shown as a range, as described in A1 (e.g. "15–30 min"). */
export function waitRange(peopleAhead: number, minutesEach: number): string {
  if (peopleAhead === 0) return 'you are next'
  const high = peopleAhead * minutesEach
  const low = Math.round(high / 2)
  return `${low}–${high} min`
}
