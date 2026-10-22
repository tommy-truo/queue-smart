import { useEffect, useRef, useState } from 'react'
import { api } from './api.ts'
import { useAuth } from './auth/AuthContext.ts'
import type { QueueEntry, Service } from './types.ts'

export type QueueView = QueueEntry & { position: number; estimatedWait: number }
export type ServiceSummary = Service & { queueLength: number; estimatedWait: number }
type QueueData = { key: string; services: ServiceSummary[]; entries: QueueView[]; error: string }

/** Both queue views read the same services and entries used by backend history. */
export function useQueues(serviceId?: string) {
  const { user } = useAuth()
  const key = `${user?.id ?? 'guest'}:${serviceId ?? 'mine'}`
  const generation = useRef(0)
  const [data, setData] = useState<QueueData | null>(null)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [feedback, setFeedback] = useState({ key: '', message: '', error: '' })

  useEffect(() => {
    generation.current += 1
    let active = true
    const path = serviceId ? `/queues/${encodeURIComponent(serviceId)}` : '/queues/mine'
    Promise.all([api<ServiceSummary[]>('/services'), api<QueueView[]>(path)])
      .then(([services, entries]) => {
        if (active) setData({ key, services, entries, error: '' })
      })
      .catch(error => {
        if (active) setData({ key, services: [], entries: [], error: error instanceof Error ? error.message : 'Could not load queues.' })
      })
    return () => { active = false; generation.current += 1 }
  }, [key, serviceId, revision])

  function refresh() {
    setData(null)
    setRevision(value => value + 1)
  }

  async function runAction(action: () => Promise<string>) {
    // Guard synchronously: two rapid serve clicks must never serve two people.
    if (pending.current) return
    const actionGeneration = generation.current
    pending.current = true
    setBusy(true)
    setFeedback({ key, message: '', error: '' })
    try {
      const result = await action()
      if (generation.current === actionGeneration) {
        setFeedback({ key, message: result, error: '' })
        refresh()
      }
    } catch (error) {
      if (generation.current === actionGeneration) setFeedback({ key, message: '', error: error instanceof Error ? error.message : 'Could not update the queue.' })
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const current = data?.key === key ? data : null
  return {
    services: current?.services ?? [], entries: current?.entries ?? [],
    loading: current === null, error: current?.error ?? '',
    busy, message: feedback.key === key ? feedback.message : '',
    actionError: feedback.key === key ? feedback.error : '', refresh, runAction,
  }
}

export function joinQueue(id: string) {
  return api<QueueView>(`/queues/${encodeURIComponent(id)}/join`, { method: 'POST', body: {} })
}

export function leaveQueue(id: string) {
  return api<QueueEntry>(`/queues/${encodeURIComponent(id)}/leave`, { method: 'POST' })
}

export function serveNext(id: string) {
  return api<{ served?: QueueEntry; nowServing?: QueueEntry }>(`/queues/${encodeURIComponent(id)}/serve-next`, { method: 'POST' })
}

export function removeFromQueue(serviceId: string, entryId: string) {
  return api<QueueEntry>(`/queues/${encodeURIComponent(serviceId)}/entries/${encodeURIComponent(entryId)}/remove`, { method: 'POST' })
}

export function requeue(serviceId: string) {
  return api<QueueView>(`/queues/${encodeURIComponent(serviceId)}/requeue`, { method: 'POST' })
}
