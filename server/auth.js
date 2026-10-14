import { randomBytes, createHash } from 'node:crypto'

export const normalizePhone = (value) => {
  const digits = String(value || '').replace(/[\s()-]/g, '')
  const phone = /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : digits
  return /^\+91[6-9]\d{9}$/.test(phone) ? phone : null
}
const token = () => randomBytes(32).toString('hex')
const hash = (value) => createHash('sha256').update(value).digest('hex')
const cookies = (request) =>
  Object.fromEntries(
    (request.headers.cookie || '').split(';').map((value) => value.trim().split('=')),
  )

// Challenges and rate limits live in PostgreSQL when a pool is given, so they hold across
// serverless instances (Vercel); the in-memory store is for tests and pool-less setups.
function memoryStore(now) {
  const challenges = new Map(),
    limits = new Map()
  return {
    async sweep() {
      for (const map of [challenges, limits])
        for (const [key, value] of map) if (value.expires <= now()) map.delete(key)
    },
    async hit(key, window) {
      const record = limits.get(key) || { count: 0, expires: now() + window }
      record.count++
      limits.set(key, record)
      return record.count
    },
    async create(id, phone) {
      challenges.set(id, { phone, expires: now() + 600000, attempts: 0 })
    },
    async attempt(id) {
      const challenge = challenges.get(id)
      if (!challenge) return null
      challenge.attempts++
      return challenge
    },
    async consume(id) {
      return challenges.delete(id)
    },
  }
}
function databaseStore(pool) {
  return {
    async sweep() {
      await pool.query('DELETE FROM customer_otp_challenges WHERE expires_at<=now()')
      await pool.query('DELETE FROM auth_rate_limits WHERE expires_at<=now()')
    },
    async hit(key, window) {
      const { rows } = await pool.query(
        `INSERT INTO auth_rate_limits(key,count,expires_at) VALUES($1,1,now()+$2*interval '1 millisecond')
        ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_rate_limits.expires_at<=now() THEN 1 ELSE auth_rate_limits.count+1 END,
        expires_at=CASE WHEN auth_rate_limits.expires_at<=now() THEN EXCLUDED.expires_at ELSE auth_rate_limits.expires_at END RETURNING count`,
        [key, window],
      )
      return rows[0].count
    },
    async create(id, phone) {
      await pool.query(
        "INSERT INTO customer_otp_challenges(token_hash,phone,expires_at) VALUES($1,$2,now()+interval '10 minutes')",
        [hash(id), phone],
      )
    },
    async attempt(id) {
      return (
        (
          await pool.query(
            'UPDATE customer_otp_challenges SET attempts=attempts+1 WHERE token_hash=$1 AND expires_at>now() RETURNING phone,attempts',
            [hash(id)],
          )
        ).rows[0] || null
      )
    },
    async consume(id) {
      return (
        (await pool.query('DELETE FROM customer_otp_challenges WHERE token_hash=$1', [hash(id)]))
          .rowCount > 0
      )
    },
  }
}

export function createAuthHandler({
  env = process.env,
  fetchImpl = fetch,
  now = Date.now,
  pool,
} = {}) {
  const sessions = new Map(),
    store = pool ? databaseStore(pool) : memoryStore(now)
  const ready = Boolean(
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID,
  )
  const origin = env.AUTH_ORIGIN || 'http://localhost:5173'
  const secure = origin.startsWith('https:')
  const cookie = (name, value, age) =>
    `${name}=${value}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=${age}${secure ? '; Secure' : ''}`
  const fail = (status, message) => Object.assign(new Error(message), { status })
  async function limit(key, max, window) {
    if ((await store.hit(key, window)) > max)
      throw fail(429, 'Too many attempts. Please wait before trying again.')
  }
  async function provider(path, fields) {
    const response = await fetchImpl(
      `https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(fields),
        signal: AbortSignal.timeout(15000),
      },
    )
    const data = await response.json()
    if (!response.ok) {
      if (response.status === 429 || data.code === 60202)
        throw fail(429, 'Too many attempts. Please request a new code later.')
      if (response.status === 404)
        throw fail(400, 'This code has expired. Please request a new one.')
      throw fail(502, 'We could not complete verification. Please try again later.')
    }
    return data
  }
  return async function auth(request, response, next) {
    const path = request.url?.split('?')[0]
    if (!path?.startsWith('/api/auth/')) return next?.()
    const send = (status, body) => {
      response.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      })
      response.end(JSON.stringify(body))
    }
    try {
      for (const [key, value] of sessions) if (value.expires <= now()) sessions.delete(key)
      const jar = cookies(request)
      if (request.method === 'GET' && path === '/api/auth/session') {
        const session =
          pool && jar.kimish_session
            ? (
                await pool.query(
                  'SELECT c.phone FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=$1 AND s.expires_at>now()',
                  [hash(jar.kimish_session)],
                )
              ).rows[0]
            : sessions.get(jar.kimish_session)
        return send(200, { user: session ? { phone: session.phone } : null, available: ready })
      }
      if (request.method !== 'POST') return send(405, { message: 'Method not allowed.' })
      if (request.headers.origin !== origin)
        return send(403, { message: 'Request origin is not allowed.' })
      if (!request.headers['content-type']?.startsWith('application/json'))
        return send(415, { message: 'JSON is required.' })
      if (path === '/api/auth/logout') {
        sessions.delete(jar.kimish_session)
        if (pool && jar.kimish_session)
          await pool.query('DELETE FROM customer_sessions WHERE token_hash=$1', [
            hash(jar.kimish_session),
          ])
        if (jar.kimish_challenge) await store.consume(jar.kimish_challenge)
        response.setHeader('Set-Cookie', [
          cookie('kimish_session', '', 0),
          cookie('kimish_challenge', '', 0),
        ])
        return send(200, { user: null })
      }
      if (!['/api/auth/send', '/api/auth/verify'].includes(path))
        return send(404, { message: 'Not found.' })
      if (!ready)
        return send(503, {
          message: 'Phone login is not available yet. Please continue shopping as a guest.',
        })
      // Under Express the JSON body was already parsed (and the stream consumed) by express.json().
      let body = request.body
      if (!body || typeof body !== 'object') {
        let raw = ''
        for await (const chunk of request) {
          raw += chunk
          if (Buffer.byteLength(raw) > 2048) throw fail(413, 'Request too large.')
        }
        try {
          body = JSON.parse(raw)
        } catch {
          throw fail(400, 'Invalid request.')
        }
      }
      // Behind Vercel's proxy the socket address is the proxy's; Vercel sets x-real-ip to the client address.
      const ip =
        (env.VERCEL && request.headers['x-real-ip']) || request.socket.remoteAddress || 'unknown'
      await store.sweep()
      if (path === '/api/auth/send') {
        const phone = normalizePhone(body.phone)
        if (!phone) throw fail(400, 'Enter a valid 10-digit Indian mobile number.')
        await limit(`send-ip:${ip}`, 10, 3600000)
        await limit(`send-phone:${hash(phone)}`, 5, 3600000)
        await limit(`cooldown:${hash(phone)}`, 1, 60000)
        const data = await provider('Verifications', { To: phone, Channel: 'sms' })
        if (data.status !== 'pending')
          throw fail(502, 'We could not send a code. Please try again later.')
        if (jar.kimish_challenge) await store.consume(jar.kimish_challenge)
        const id = token()
        await store.create(id, phone)
        response.setHeader('Set-Cookie', cookie('kimish_challenge', id, 600))
        return send(200, { sent: true, resendAfter: 60 })
      }
      await limit(`verify-ip:${ip}`, 30, 600000)
      const challenge = jar.kimish_challenge && (await store.attempt(jar.kimish_challenge))
      if (!challenge) throw fail(400, 'Your code has expired. Please request a new one.')
      if (challenge.attempts > 5) {
        await store.consume(jar.kimish_challenge)
        throw fail(429, 'Too many attempts. Please request a new code.')
      }
      if (!/^\d{6}$/.test(String(body.code || ''))) throw fail(400, 'Enter the six-digit code.')
      const data = await provider('VerificationCheck', { To: challenge.phone, Code: body.code })
      if (data.status !== 'approved')
        throw fail(400, 'That code is incorrect or expired. Please try again.')
      // Consume the challenge before issuing a session, including concurrent checks.
      if (!(await store.consume(jar.kimish_challenge)))
        throw fail(400, 'This code was already used. Please sign in again.')
      sessions.delete(jar.kimish_session)
      const id = token()
      if (pool) {
        const customer = (
          await pool.query(
            'INSERT INTO customers(phone) VALUES($1) ON CONFLICT(phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING id',
            [challenge.phone],
          )
        ).rows[0]
        await pool.query(
          "INSERT INTO customer_sessions(token_hash,customer_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
          [hash(id), customer.id],
        )
        if (jar.kimish_session)
          await pool.query('DELETE FROM customer_sessions WHERE token_hash=$1', [
            hash(jar.kimish_session),
          ])
      } else sessions.set(id, { phone: challenge.phone, expires: now() + 604800000 })
      response.setHeader('Set-Cookie', [
        cookie('kimish_session', id, 604800),
        cookie('kimish_challenge', '', 0),
      ])
      return send(200, { user: { phone: challenge.phone } })
    } catch (error) {
      return send(error.status || 502, {
        message: error.status
          ? error.message
          : 'Verification is temporarily unavailable. Please try again later.',
      })
    }
  }
}
