export const SESSION_EVENT_KEY = 'queuesmart.sessionChanged'
export const SESSION_EXPIRED_EVENT = 'queuesmart:sessionExpired'
let sessionGeneration = 0

/** Invalidates responses that started under an earlier account/session. */
export function invalidateSessionRequests(): void { sessionGeneration += 1 }

export class ApiError extends Error {
  status: number
  fields?: Record<string, string>
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal }

function sessionCheckpoint() {
  const generation = sessionGeneration
  const marker = localStorage.getItem(SESSION_EVENT_KEY)
  return () => {
    if (generation !== sessionGeneration || marker !== localStorage.getItem(SESSION_EVENT_KEY)) {
      throw new DOMException('The session changed. Please retry.', 'AbortError')
    }
  }
}

async function response(path: string, options: Options = {}): Promise<Response> {
  const generation = sessionGeneration
  const marker = localStorage.getItem(SESSION_EVENT_KEY)
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Could not connect to QueueSmart. Check your connection and try again.')
  }
  if (generation !== sessionGeneration || marker !== localStorage.getItem(SESSION_EVENT_KEY)) {
    throw new DOMException('The session changed. Please retry.', 'AbortError')
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, data.error ?? 'Request failed.', data.fields)
  }
  return res
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const check = sessionCheckpoint()
  const res = await response(path, options)
  const data = res.status === 204 ? undefined : await res.json()
  check()
  return data as T
}

export async function download(path: string, filename: string): Promise<void> {
  const check = sessionCheckpoint()
  const res = await response(path)
  const blob = await res.blob()
  check()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Defer revocation until the browser has begun processing the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
