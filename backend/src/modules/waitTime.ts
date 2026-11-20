/** Baseline estimate for a queue with no elapsed service information. */
export function estimateWait(peopleAhead: number, expectedDuration: number): number {
  return Math.max(0, peopleAhead) * expectedDuration
}

/** Only the active service counts down; waiting and idle queues never lose time artificially. */
export function liveWait(waitingAhead: number, expectedDuration: number, calledAt?: string, now = Date.now()) {
  const elapsed = calledAt ? Math.max(0, (now - new Date(calledAt).getTime()) / 1000) : 0
  const safeElapsed = Number.isFinite(elapsed) ? elapsed : 0
  const remaining = calledAt ? Math.max(0, expectedDuration * 60 - safeElapsed) : 0
  const seconds = Math.ceil(estimateWait(waitingAhead, expectedDuration) * 60 + remaining)
  return { estimatedWait: Math.ceil(seconds / 60), estimatedWaitSeconds: seconds, serviceDelayed: !!calledAt && safeElapsed >= expectedDuration * 60, awaitingStaff: !calledAt }
}
