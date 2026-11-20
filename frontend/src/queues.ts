import { useEffect, useRef, useState } from 'react'
import { api } from './api.ts'
import { useAuth } from './auth/AuthContext.ts'
import type { Priority, QueueEntry, Service } from './types.ts'

export type QueueView = QueueEntry & { position: number; estimatedWait: number }
export type ServiceSummary = Service & { queueLength: number; estimatedWait: number }
type QueueData = { key: string; services: ServiceSummary[]; entries: QueueView[]; serviceId: string }

/** An empty service ID selects the first available staff queue; undefined loads the customer's queues. */
export function useQueues(serviceId?: string) {
  const { user } = useAuth()
  const key = `${user?.id ?? 'guest'}:${serviceId ?? 'mine'}`
  const currentKey = useRef(key)
  useEffect(() => { currentKey.current = key }, [key])
  const [data, setData] = useState<QueueData | null>(null)
  const [failure, setFailure] = useState({ key: '', message: '' })
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const request = useRef<AbortController | null>(null)
  const [feedback, setFeedback] = useState({ key: '', message: '', error: '' })

  useEffect(() => {
    let active = true
    let sequence = 0
    async function load() {
      if (pending.current) return
      const number = ++sequence
      request.current?.abort()
      const controller = new AbortController()
      request.current = controller
      try {
        const services = await api<ServiceSummary[]>('/services', { signal: controller.signal })
        const selected = serviceId === undefined ? '' : services.find(s => s.id === serviceId)?.id ?? services[0]?.id ?? ''
        const entries = serviceId !== undefined && !selected ? [] : await api<QueueView[]>(
          serviceId === undefined ? '/queues/mine' : `/queues/${encodeURIComponent(selected)}`,
          { signal: controller.signal },
        )
        if (active && number === sequence && !controller.signal.aborted) {
          setData({ key, services, entries, serviceId: selected })
          setFailure({ key, message: '' })
        }
      } catch (error) {
        if (active && number === sequence && !controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) {
          setFailure({ key, message: error instanceof Error ? error.message : 'Could not load queues.' })
        }
      }
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 5000)
    const onFocus = () => { void load() }
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      request.current?.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [key, serviceId, revision])

  function refresh() { setRevision(value => value + 1) }

  async function runAction(action: () => Promise<string>) {
    if (pending.current) return
    const actionKey = key
    pending.current = true
    request.current?.abort()
    setBusy(true)
    setFeedback({ key, message: '', error: '' })
    try {
      const result = await action()
      if (currentKey.current === actionKey) setFeedback({ key, message: result, error: '' })
    } catch (error) {
      if (currentKey.current === actionKey) setFeedback({ key, message: '', error: error instanceof Error ? error.message : 'Could not update the queue.' })
    } finally {
      pending.current = false
      setBusy(false)
      if (currentKey.current === actionKey) refresh()
    }
  }

  const current = data?.key === key ? data : null
  const loadError = failure.key === key ? failure.message : ''
  return {
    services: current?.services ?? [], entries: current?.entries ?? [], selectedServiceId: current?.serviceId ?? '',
    loading: current === null && !loadError, error: current === null ? loadError : '',
    busy, message: feedback.key === key ? feedback.message : '',
    actionError: (feedback.key === key ? feedback.error : '') || loadError, refresh, runAction,
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

export function reorderQueueEntry(serviceId: string, entryId: string, direction: 'up' | 'down') {
  return api<QueueView>(
    `/queues/${encodeURIComponent(serviceId)}/entries/${encodeURIComponent(entryId)}/reorder`,
    { method: 'POST', body: { direction } },
  )
}

export function setQueuePriority(serviceId: string, entryId: string, priority: Priority) {
  return api<QueueView>(`/queues/${encodeURIComponent(serviceId)}/entries/${encodeURIComponent(entryId)}/priority`, {
    method: 'POST', body: { priority },
  })
}
