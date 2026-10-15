export const SESSION_USER_KEY = 'queuesmart.sessionUser'

export class ApiError extends Error {
  status: number
  fields?: Record<string, string>

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

function sessionUserId(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY)
    return raw ? (JSON.parse(raw) as { id: string }).id : null
  } catch {
    return null
  }
}

/** Calls the backend (proxied to /api by Vite) and throws an ApiError on failure. */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const userId = sessionUserId()
  if (userId) headers['x-user-id'] = userId

  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is the backend running?')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Request failed.', data.fields)
  return data as T
}
