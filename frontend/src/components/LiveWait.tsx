import { useEffect, useState } from 'react'
import type { QueueView } from '../queues.ts'

/** Each server sample anchors a new clock; client clock skew does not alter the estimate. */
export default function LiveWait({ entry }: { entry: QueueView }) {
  return <WaitClock key={`${entry.id}:${entry.estimateUpdatedAt ?? ''}:${entry.estimatedWaitSeconds ?? entry.estimatedWait}`} entry={entry} />
}

function WaitClock({ entry }: { entry: QueueView }) {
  const seconds = entry.estimatedWaitSeconds ?? entry.estimatedWait * 60
  const [receivedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (entry.status === 'serving') return <>Being served</>
  const counting = entry.estimatedWaitSeconds !== undefined && !entry.serviceDelayed && !entry.awaitingStaff
  const remaining = counting ? Math.max(entry.countdownFloorSeconds ?? 0, seconds - Math.max(0, Math.floor((now - receivedAt) / 1000))) : seconds
  if (remaining === 0 && entry.serviceDelayed) return <>Waiting for current service to finish. Service is taking longer than expected.</>
  if (remaining === 0 && entry.awaitingStaff) return <>Waiting for staff to call the next customer.</>
  const display = `${Math.floor(remaining / 60)} min ${String(Math.floor(remaining % 60)).padStart(2, '0')} sec`
  return <span>{display}{entry.serviceDelayed ? <small className="wait-note"> Service is taking longer than expected; this estimate may change.</small> : entry.awaitingStaff ? <small className="wait-note"> Waiting for staff to start service.</small> : null}</span>
}
