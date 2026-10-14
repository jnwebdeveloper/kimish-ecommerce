import test from 'node:test'
import assert from 'node:assert/strict'
import { createApi } from './api.js'

// No database needed: port 1 refuses connections, which turns /api/health into a real 500
const env = {
  DATABASE_URL: 'postgresql://kimish:x@127.0.0.1:1/none',
  AUTH_ORIGIN: 'http://localhost:5173',
  LOG_LEVEL: 'info',
}

test('API requests get an id and one JSON log line; failures log the stack without leaking it', async () => {
  const lines = [],
    original = { log: console.log, error: console.error }
  console.log = console.error = (line) => lines.push(JSON.parse(line))
  const { api, pool } = createApi(env),
    server = api.listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    // Server fault: 500 with a request id the user can report; the stack only goes to the log
    let r = await fetch(`${base}/api/health?token=secret-value`)
    let body = await r.json()
    const id = r.headers.get('x-request-id')
    assert.equal(r.status, 500)
    assert.equal(body.requestId, id)
    assert.ok(!JSON.stringify(body).includes('ECONNREFUSED'))
    const failed = lines.find((l) => l.msg === 'request failed')
    assert.equal(failed.level, 'error')
    assert.equal(failed.requestId, id)
    assert.ok(failed.err.stack)
    const request = lines.find((l) => l.msg === 'request' && l.requestId === id)
    assert.equal(request.level, 'error')
    assert.equal(request.method, 'GET')
    assert.equal(request.path, '/api/health')
    assert.equal(request.status, 500)
    assert.equal(typeof request.ms, 'number')
    // Query strings never reach the log
    assert.ok(!JSON.stringify(lines).includes('secret-value'))

    // A caller's valid X-Request-Id is kept; routine 4xx responses log at info
    r = await fetch(`${base}/api/admin/products`, { headers: { 'X-Request-Id': 'trace-12345' } })
    assert.equal(r.status, 401)
    assert.equal(r.headers.get('x-request-id'), 'trace-12345')
    const denied = lines.find((l) => l.requestId === 'trace-12345')
    assert.deepEqual([denied.level, denied.status], ['info', 401])
    body = await r.json()
    assert.equal(body.requestId, undefined)

    // An invalid incoming id is replaced
    r = await fetch(`${base}/api/admin/products`, { headers: { 'X-Request-Id': 'bad id!' } })
    assert.match(r.headers.get('x-request-id'), /^[0-9a-f-]{36}$/)

    // Refused cross-site writes are logged as warnings
    r = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: '{}',
    })
    assert.equal(r.status, 403)
    assert.equal(lines.find((l) => l.status === 403).level, 'warn')
  } finally {
    Object.assign(console, original)
    await new Promise((r) => server.close(r))
    await pool.end()
  }
})
