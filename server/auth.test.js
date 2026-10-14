import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { loadEnv } from 'vite'
import { createApi } from './api.js'
import { createAuthHandler, normalizePhone } from './auth.js'
const env = {
  AUTH_ORIGIN: 'http://localhost:5173',
  TWILIO_ACCOUNT_SID: 'test',
  TWILIO_AUTH_TOKEN: 'test',
  TWILIO_VERIFY_SERVICE_SID: 'test',
}
async function request(handler, path, body, cookie = '', origin = env.AUTH_ORIGIN) {
  const req = Readable.from(body ? [JSON.stringify(body)] : [])
  Object.assign(req, {
    url: '/api/auth/' + path,
    method: body ? 'POST' : 'GET',
    headers: { origin, 'content-type': 'application/json', cookie },
    socket: { remoteAddress: 'test' },
  })
  let headers = {},
    status,
    data
  const res = {
    setHeader(k, v) {
      headers[k] = v
    },
    writeHead(s, h) {
      status = s
      Object.assign(headers, h)
    },
    end(v) {
      data = JSON.parse(v)
    },
  }
  await handler(req, res)
  return { status, data, headers }
}
test('Phone OTP fails closed, rejects bad codes, issues/revokes a session, expires and throttles', async () => {
  assert.equal(normalizePhone('123'), null)
  const disabled = createAuthHandler({ env: {} })
  assert.equal((await request(disabled, 'send', { phone: '9000000001' })).status, 503)
  let time = Date.now()
  const handler = createAuthHandler({
    env,
    now: () => time,
    fetchImpl: async (url, options) => ({
      ok: true,
      json: async () => ({
        status: url.endsWith('/Verifications')
          ? 'pending'
          : options.body.get('Code') === '123456'
            ? 'approved'
            : 'pending',
      }),
    }),
  })
  assert.equal(
    (await request(handler, 'send', { phone: '9000000001' }, '', 'https://bad.invalid')).status,
    403,
  )
  let r = await request(handler, 'send', { phone: '9000000001' })
  assert.equal(r.status, 200)
  const challenge = r.headers['Set-Cookie'].split(';')[0]
  assert.equal((await request(handler, 'send', { phone: '9000000001' })).status, 429)
  assert.equal((await request(handler, 'verify', { code: '999999' }, challenge)).status, 400)
  r = await request(handler, 'verify', { code: '123456' }, challenge)
  assert.equal(r.status, 200)
  const session = r.headers['Set-Cookie'][0].split(';')[0]
  assert.match(r.headers['Set-Cookie'][0], /HttpOnly/)
  assert.equal((await request(handler, 'verify', { code: '123456' }, challenge)).status, 400)
  assert.equal((await request(handler, 'session', null, session)).data.user.phone, '+919000000001')
  await request(handler, 'logout', {}, session)
  assert.equal((await request(handler, 'session', null, session)).data.user, null)
  time += 61000
  r = await request(handler, 'send', { phone: '9000000001' })
  const expired = r.headers['Set-Cookie'].split(';')[0]
  time += 600001
  assert.equal((await request(handler, 'verify', { code: '123456' }, expired)).status, 400)
})
const twilio = async (url, options) => ({
  ok: true,
  json: async () => ({
    status: url.endsWith('/Verifications')
      ? 'pending'
      : options.body.get('Code') === '123456'
        ? 'approved'
        : 'pending',
  }),
})
test('Phone OTP works through the Express stack with challenges shared across instances via PostgreSQL', async () => {
  const dbEnv = { ...loadEnv('development', process.cwd(), ''), ...process.env, ...env }
  // Two separate API instances sharing one database, like two serverless invocations
  const instances = [createApi(dbEnv), createApi(dbEnv)].map(({ api, pool }) => {
    api.use(createAuthHandler({ env: dbEnv, pool, fetchImpl: twilio }))
    return { pool, server: api.listen(0, '127.0.0.1') }
  })
  await Promise.all(
    instances.map(
      ({ server }) => new Promise((r) => (server.listening ? r() : server.once('listening', r))),
    ),
  )
  const call = async (i, path, body, cookie = '') => {
    const response = await fetch(
      `http://127.0.0.1:${instances[i].server.address().port}/api/auth/${path}`,
      {
        method: body ? 'POST' : 'GET',
        headers: { Origin: env.AUTH_ORIGIN, 'Content-Type': 'application/json', Cookie: cookie },
        body: body ? JSON.stringify(body) : undefined,
      },
    )
    return {
      status: response.status,
      data: await response.json(),
      cookies: response.headers.getSetCookie(),
    }
  }
  const phone = '9' + String(Date.now()).slice(-9),
    pool = instances[0].pool
  // Per-IP limits persist in the database; reset localhost's so repeated test runs don't hit them
  await pool.query(
    "DELETE FROM auth_rate_limits WHERE key ~ '^(send|verify)-ip:(::ffff:)?127\\.0\\.0\\.1$'",
  )
  try {
    let r = await call(0, 'send', { phone })
    assert.equal(r.status, 200, JSON.stringify(r.data))
    const challenge = r.cookies[0].split(';')[0]
    assert.equal((await call(1, 'send', { phone })).status, 429)
    assert.equal((await call(1, 'verify', { code: '999999' }, challenge)).status, 400)
    r = await call(1, 'verify', { code: '123456' }, challenge)
    assert.equal(r.status, 200, JSON.stringify(r.data))
    assert.equal(r.data.user.phone, '+91' + phone)
    const session = r.cookies[0].split(';')[0]
    assert.equal((await call(0, 'verify', { code: '123456' }, challenge)).status, 400)
    assert.equal((await call(0, 'session', null, session)).data.user.phone, '+91' + phone)
  } finally {
    await pool.query('DELETE FROM customers WHERE phone=$1', ['+91' + phone])
    await Promise.all(
      instances.map(({ server, pool }) =>
        new Promise((r) => server.close(r)).then(() => pool.end()),
      ),
    )
  }
})
