/** Rule-based estimate: everyone ahead of you takes the service's expected duration. */
export function estimateWait(peopleAhead: number, expectedDuration: number): number {
  return Math.max(0, peopleAhead) * expectedDuration
}
