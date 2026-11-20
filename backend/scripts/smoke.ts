import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

// A real HTTP crawl against a disposable API process and SQLite file. Never uses the application DB.
const backend = fileURLToPath(new URL('../', import.meta.url))
const directory = await mkdtemp(path.join(os.tmpdir(), 'queuesmart-smoke-'))
const dbFile = path.join(directory, 'smoke.db')
const require = createRequire(import.meta.url)
let child: ChildProcess | undefined
let output = ''
let base = ''
let checks = 0
const completed: string[] = []
type Json = Record<string, any>
type Client = { cookie?: string }

function verify(condition: unknown, label: string): asserts condition {
  checks += 1
  assert.ok(condition, label)
  completed.push(label)
}

async function freePort(): Promise<number> {
  const listener = createServer()
  await new Promise<void>((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve) })
  const address = listener.address()
  assert.ok(address && typeof address !== 'string')
  const port = address.port
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()))
  return port
}

async function stop(): Promise<void> {
  const running = child
  child = undefined
  if (!running || running.exitCode !== null || running.signalCode !== null) return
  await new Promise<void>(resolve => {
    const timeout = setTimeout(() => { running.kill('SIGKILL') }, 3000)
    running.once('exit', () => { clearTimeout(timeout); resolve() })
    running.kill('SIGTERM')
  })
}

// Interruptions also clean up the child and temporary database rather than leaving a QA server running.
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]] as const) {
  process.once(signal, () => {
    void (async () => {
      await stop()
      await rm(directory, { recursive: true, force: true })
      process.exit(code)
    })()
  })
}

async function start(): Promise<void> {
  const port = await freePort()
  base = `http://127.0.0.1:${port}/api`
  output = ''
  const running = spawn(process.execPath, [require.resolve('tsx/cli'), 'src/server.ts'], {
    cwd: backend,
    env: { ...process.env, DB_FILE: dbFile, PORT: String(port), NODE_ENV: 'development', APP_ORIGIN: `http://127.0.0.1:${port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child = running
  let startupError: Error | undefined
  running.once('error', error => { startupError = error })
  for (const stream of [running.stdout, running.stderr]) stream?.on('data', data => { output = (output + String(data)).slice(-12000) })
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    if (startupError) throw startupError
    if (running.exitCode !== null) throw new Error(`Smoke API exited before startup: ${output}`)
    try {
      const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) })
      if (response.ok) return
    } catch { /* The listener is still starting. */ }
    await delay(100)
  }
  throw new Error(`Smoke API did not become ready: ${output}`)
}

async function call(method: string, endpoint: string, expected: number, client: Client = {}, body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}${endpoint}`, {
    method,
    headers: { ...(client.cookie ? { Cookie: client.cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  const text = await response.text()
  verify(response.status === expected, `${method} ${endpoint}: expected ${expected}, received ${response.status}`)
  let data: any
  try { data = JSON.parse(text) } catch { data = text }
  return { response, data, text }
}

function acceptCookie(client: Client, response: Response): void {
  const cookie = response.headers.getSetCookie().find(value => /^queuesmart_session=[a-f0-9]{64};/.test(value))
  verify(cookie, 'login/registration issues a random session cookie')
  verify(cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict') && cookie.includes('Path=/api'), 'session cookie has required protections')
  client.cookie = cookie.split(';')[0]
}

async function login(email: string, password: string, client: Client = {}): Promise<Client> {
  const result = await call('POST', '/auth/login', 200, client, { email, password })
  acceptCookie(client, result.response)
  return client
}

async function register(email: string): Promise<{ client: Client; user: Json }> {
  const client: Client = {}
  const result = await call('POST', '/auth/register', 201, client, { email, password: 'SmokePass1', fullName: 'Smoke Tester' })
  acceptCookie(client, result.response)
  return { client, user: result.data }
}

try {
  await start()
  await call('GET', '/health', 200)
  const admin = await login('admin@queuesmart.local', 'AdminPass1')
  const employee = await login('employee@queuesmart.local', 'EmployeePass1')
  const seededUser = await login('alex.kim@example.com', 'UserPass1')
  const clients: Record<string, Client> = { guest: {}, forged: { cookie: `queuesmart_session=${'a'.repeat(64)}` }, user: seededUser, admin, employee }
  const reads: [string, string[]][] = [
    ['/auth/session', ['user', 'admin', 'employee']], ['/services', ['user', 'admin', 'employee']],
    ['/queues', ['admin']], ['/queues/mine', ['user']], ['/queues/s1', ['admin', 'employee']],
    ['/me/history', ['user']], ['/me/notifications', ['user', 'admin', 'employee']],
    ['/reports/participation', ['admin']], ['/reports/services', ['admin']], ['/reports/wait-by-hour', ['admin']],
  ]
  for (const [endpoint, roles] of reads) {
    for (const [role, client] of Object.entries(clients)) await call('GET', endpoint, role === 'guest' || role === 'forged' ? 401 : roles.includes(role) ? 200 : 403, client)
  }
  await call('GET', '/reports/services', 401, {}, undefined, { 'x-user-id': 'a1' })
  const writes: [string, string, string[]][] = [
    ['POST', '/services', ['admin']], ['PUT', '/services/s1', ['admin']],
    ['POST', '/queues/s1/join', ['user']], ['POST', '/queues/s1/leave', ['user']],
    ['POST', '/queues/s1/serve-next', ['admin', 'employee']], ['POST', '/queues/s1/requeue', ['admin', 'employee']],
    ['POST', '/queues/s1/entries/q2/remove', ['admin', 'employee']], ['POST', '/queues/s1/entries/q2/reorder', ['admin']],
    ['POST', '/queues/s1/entries/q2/priority', ['admin', 'employee']],
  ]
  for (const [method, endpoint, roles] of writes) {
    for (const [role, client] of Object.entries(clients)) {
      if (!roles.includes(role)) await call(method, endpoint, role === 'guest' || role === 'forged' ? 401 : 403, client, {})
    }
  }
  await call('POST', '/auth/login', 401, {}, { email: 'alex.kim@example.com', password: 'wrong' })
  await call('POST', '/auth/login', 401, {}, { email: "' OR 1=1 --", password: 'SmokePass1' })
  await call('POST', '/auth/register', 400, {}, {})
  const { client: customer, user } = await register('smoke@example.com')
  const { client: second } = await register('smoke-second@example.com')
  await call('POST', '/auth/register', 409, {}, { email: user.email, password: 'SmokePass1', fullName: 'Smoke Tester' })
  const serviceInput = { name: 'Smoke Service', description: 'Temporary end-to-end service', expectedDuration: 5, priority: 'medium' }
  const service = (await call('POST', '/services', 201, admin, serviceInput)).data
  const queue = `/queues/${service.id}`
  await call('POST', '/services', 409, admin, serviceInput)
  await call('POST', `${queue}/serve-next`, 409, employee)
  await call('POST', `${queue}/requeue`, 409, employee)
  for (const body of [{ name: null }, { expectedDuration: null }, { open: null }, { notification: null }, []]) await call('PUT', `/services/${service.id}`, 400, admin, body)
  for (const body of [{ priority: 'high' }, { priority: 'low' }, { priority: null }]) await call('POST', `${queue}/join`, 400, customer, body)
  const entry = (await call('POST', `${queue}/join`, 201, customer, {})).data
  const next = (await call('POST', `${queue}/join`, 201, second, {})).data
  await call('POST', `${queue}/join`, 409, customer, {})
  const mine = (await call('GET', '/queues/mine', 200, customer)).data as Json[]
  verify(mine.some(row => row.id === entry.id) && !mine.some(row => row.id === next.id), 'customer sees only own queue entries')
  for (const body of [{}, { direction: null }, { direction: 'sideways' }]) await call('POST', `${queue}/entries/${next.id}/reorder`, 400, admin, body)
  await call('POST', `${queue}/entries/${next.id}/reorder`, 400, admin)
  await call('POST', `${queue}/entries/${next.id}/reorder`, 200, admin, { direction: 'up' })
  const raised = (await call('POST', `${queue}/entries/${entry.id}/priority`, 200, employee, { priority: 'high' })).data
  verify(raised.position === 1 && raised.priority === 'high', 'staff priority assignment changes queue order')
  await call('POST', `${queue}/entries/${next.id}/priority`, 200, admin, { priority: 'low' })
  await call('POST', `${queue}/entries/${next.id}/priority`, 400, admin, { priority: 'urgent' })
  await call('POST', `${queue}/entries/${entry.id}/priority`, 403, customer, { priority: 'high' })
  const called = (await call('POST', `${queue}/serve-next`, 200, employee, { expectedEntryId: raised.id, expectedStatus: raised.status })).data
  verify(called.nowServing.id === entry.id, 'serve-next calls the first customer')
  await call('POST', `${queue}/serve-next`, 409, employee, { expectedEntryId: raised.id, expectedStatus: raised.status })
  await call('POST', `${queue}/requeue`, 200, employee, { expectedEntryId: entry.id, expectedStatus: 'serving' })
  await call('POST', `${queue}/serve-next`, 200, employee)
  const finished = (await call('POST', `${queue}/serve-next`, 200, employee)).data
  verify(finished.served.id === entry.id && finished.nowServing.id === next.id, 'completion records the served user and advances queue')
  await call('POST', `${queue}/serve-next`, 200, employee)
  await call('POST', `${queue}/join`, 201, customer, {})
  await call('POST', `${queue}/leave`, 200, customer)
  await call('POST', `${queue}/leave`, 404, customer)
  const removed = (await call('POST', `${queue}/join`, 201, customer, {})).data
  await call('POST', `${queue}/entries/${removed.id}/remove`, 200, admin)
  const history = (await call('GET', '/me/history', 200, customer)).data as Json[]
  verify(['served', 'left', 'removed'].every(outcome => history.some(row => row.serviceName === service.name && row.outcome === outcome)), 'all queue outcomes appear in customer history')
  const notifications = (await call('GET', '/me/notifications', 200, customer)).data as Json[]
  verify(notifications.length > 0 && notifications.every(row => row.userId === user.id), 'notifications are persisted and account-specific')
  await call('PUT', `/services/${service.id}`, 200, admin, { open: false })
  await call('POST', `${queue}/join`, 409, customer, {})
  await call('PUT', `/services/${service.id}`, 200, admin, { open: true })
  for (const name of ['participation', 'services', 'wait-by-hour']) {
    const csv = await call('GET', `/reports/${name}?format=csv&serviceId=${service.id}`, 200, admin)
    verify(csv.response.headers.get('content-type')?.includes('text/csv') && csv.response.headers.get('content-disposition')?.includes('.csv'), `${name} exports a CSV attachment`)
    await call('GET', `/reports/${name}?serviceId=missing`, 404, admin)
    for (const filter of ['from=2026-99-99', 'from=2026-02-30', 'from=2026-12-01&to=2026-01-01', 'serviceId=s1&serviceId=s2']) await call('GET', `/reports/${name}?${filter}`, 400, admin)
  }
  const before = (await call('GET', `/reports/participation?serviceId=${service.id}`, 200, admin)).data as Json[]
  await call('PUT', `/services/${service.id}`, 200, admin, { name: 'Renamed Smoke Service' })
  const after = (await call('GET', `/reports/participation?serviceId=${service.id}`, 200, admin)).data as Json[]
  verify(after.length === before.length && after.every(row => row.serviceName === serviceInput.name), 'renaming preserves historical association and snapshot names')
  const replacement = (await call('POST', '/services', 201, admin, serviceInput)).data
  verify((await call('GET', `/reports/participation?serviceId=${replacement.id}`, 200, admin)).data.length === 0, 'reused service name does not inherit another service history')
  const activity = (await call('GET', `/reports/services?serviceId=${service.id}`, 200, admin)).data[0]
  verify(activity.served === 2 && activity.left === 1 && activity.removed === 1, 'service usage report has accurate queue outcomes after rename')
  await call('POST', '/auth/logout', 403, admin, undefined, { Origin: 'https://attacker.example' })
  await call('POST', '/auth/logout', 403, admin, undefined, { 'Sec-Fetch-Site': 'cross-site' })
  await call('GET', '/auth/session', 200, admin)
  await call('GET', '/missing', 404)

  // Expire only a disposable session directly, then exercise normal HTTP authentication.
  const expiring = await login('smoke-second@example.com', 'SmokePass1')
  const db = new DatabaseSync(dbFile)
  try {
    const token = expiring.cookie!.split('=')[1]!
    db.prepare('UPDATE Session SET expiresAt = ? WHERE tokenHash = ?').run(Date.now() - 1, createHash('sha256').update(token).digest('hex'))
  } finally { db.close() }
  await call('GET', '/auth/session', 401, expiring)

  // Real process restart, same file and browser cookie, no fixtures injected.
  await stop()
  await start()
  const persisted = (await call('GET', '/auth/session', 200, customer)).data
  verify(persisted.id === user.id, 'session cookie and registered account survive an API restart')
  const persistedHistory = (await call('GET', '/me/history', 200, customer)).data as Json[]
  verify(persistedHistory.length === history.length, 'history survives an API restart')
  const persistedServices = (await call('GET', '/services', 200, admin)).data as Json[]
  verify(persistedServices.some(row => row.id === service.id && row.name === 'Renamed Smoke Service'), 'service changes survive an API restart')
  await login('smoke@example.com', 'SmokePass1')
  await call('POST', '/auth/logout', 204, customer)
  await call('GET', '/auth/session', 401, customer)
  await call('POST', '/auth/logout', 204)
  console.log(JSON.stringify({ result: 'PASS', checks, coverage: 'HTTP role matrix, queue lifecycle, reports/export, negative inputs, sessions, process restart persistence' }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ result: 'FAIL', checks, lastPassed: completed.at(-1), error: error instanceof Error ? error.message : String(error), serverOutput: output }, null, 2))
  process.exitCode = 1
} finally {
  await stop()
  await rm(directory, { recursive: true, force: true })
}
