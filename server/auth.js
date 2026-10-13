import { randomBytes, createHash } from 'node:crypto'

export const normalizePhone = value => {
  const digits = String(value || '').replace(/[\s()-]/g, '')
  const phone = /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : digits
  return /^\+91[6-9]\d{9}$/.test(phone) ? phone : null
}
const token = () => randomBytes(32).toString('hex')
const hash = value => createHash('sha256').update(value).digest('hex')
const cookies = request => Object.fromEntries((request.headers.cookie || '').split(';').map(value => value.trim().split('=')))

export function createAuthHandler({ env = process.env, fetchImpl = fetch, now = Date.now, pool } = {}) {
  const sessions = new Map(), challenges = new Map(), limits = new Map()
  const ready = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID)
  const origin = env.AUTH_ORIGIN || 'http://localhost:5173'
  const secure = origin.startsWith('https:')
  const cookie = (name, value, age) => `${name}=${value}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=${age}${secure ? '; Secure' : ''}`
  const fail = (status, message) => Object.assign(new Error(message), { status })
  function limit(key, max, window) {
    const record = limits.get(key) || { count: 0, expires: now() + window }
    if (record.count >= max) throw fail(429, 'Too many attempts. Please wait before trying again.')
    record.count++; limits.set(key, record)
  }
  async function provider(path, fields) {
    const response = await fetchImpl(`https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/${path}`, {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields), signal: AbortSignal.timeout(15000),
    })
    const data = await response.json()
    if (!response.ok) {
      if (response.status === 429 || data.code === 60202) throw fail(429, 'Too many attempts. Please request a new code later.')
      if (response.status === 404) throw fail(400, 'This code has expired. Please request a new one.')
      throw fail(502, 'We could not complete verification. Please try again later.')
    }
    return data
  }
  return async function auth(request, response, next) {
    const path = request.url?.split('?')[0]
    if (!path?.startsWith('/api/auth/')) return next?.()
    const send = (status, body) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)) }
    try {
      for (const map of [sessions, challenges, limits]) for (const [key, value] of map) if (value.expires <= now()) map.delete(key)
      const jar = cookies(request)
      if (request.method === 'GET' && path === '/api/auth/session') {
        const session = pool && jar.kimish_session ? (await pool.query('SELECT c.phone FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hash(jar.kimish_session)])).rows[0] : sessions.get(jar.kimish_session)
        return send(200, { user: session ? { phone: session.phone } : null, available: ready })
      }
      if (request.method !== 'POST') return send(405, { message: 'Method not allowed.' })
      if (request.headers.origin !== origin) return send(403, { message: 'Request origin is not allowed.' })
      if (!request.headers['content-type']?.startsWith('application/json')) return send(415, { message: 'JSON is required.' })
      if (path === '/api/auth/logout') {
        sessions.delete(jar.kimish_session); if(pool&&jar.kimish_session)await pool.query('DELETE FROM customer_sessions WHERE token_hash=$1',[hash(jar.kimish_session)]); challenges.delete(jar.kimish_challenge)
        response.setHeader('Set-Cookie', [cookie('kimish_session', '', 0), cookie('kimish_challenge', '', 0)])
        return send(200, { user: null })
      }
      if (!['/api/auth/send', '/api/auth/verify'].includes(path)) return send(404, { message: 'Not found.' })
      if (!ready) return send(503, { message: 'Phone login is not available yet. Please continue shopping as a guest.' })
      let raw = ''
      for await (const chunk of request) { raw += chunk; if (Buffer.byteLength(raw) > 2048) throw fail(413, 'Request too large.') }
      let body
      try { body = JSON.parse(raw) } catch { throw fail(400, 'Invalid request.') }
      const ip = request.socket.remoteAddress || 'unknown'
      if (path === '/api/auth/send') {
        const phone = normalizePhone(body.phone)
        if (!phone) throw fail(400, 'Enter a valid 10-digit Indian mobile number.')
        limit(`send-ip:${ip}`, 10, 3600000)
        limit(`send-phone:${hash(phone)}`, 5, 3600000)
        limit(`cooldown:${hash(phone)}`, 1, 60000)
        const data = await provider('Verifications', { To: phone, Channel: 'sms' })
        if (data.status !== 'pending') throw fail(502, 'We could not send a code. Please try again later.')
        challenges.delete(jar.kimish_challenge)
        const id = token(); challenges.set(id, { phone, expires: now() + 600000, attempts: 0 })
        response.setHeader('Set-Cookie', cookie('kimish_challenge', id, 600))
        return send(200, { sent: true, resendAfter: 60 })
      }
      limit(`verify-ip:${ip}`, 30, 600000)
      const challenge = challenges.get(jar.kimish_challenge)
      if (!challenge) throw fail(400, 'Your code has expired. Please request a new one.')
      if (challenge.attempts >= 5) { challenges.delete(jar.kimish_challenge); throw fail(429, 'Too many attempts. Please request a new code.') }
      challenge.attempts++
      if (!/^\d{6}$/.test(String(body.code || ''))) throw fail(400, 'Enter the six-digit code.')
      const data = await provider('VerificationCheck', { To: challenge.phone, Code: body.code })
      if (data.status !== 'approved') throw fail(400, 'That code is incorrect or expired. Please try again.')
      // Consume the challenge before issuing a session, including concurrent checks.
      if (!challenges.delete(jar.kimish_challenge)) throw fail(400, 'This code was already used. Please sign in again.')
      sessions.delete(jar.kimish_session)
      const id = token(); if(pool){ const customer=(await pool.query('INSERT INTO customers(phone) VALUES($1) ON CONFLICT(phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING id',[challenge.phone])).rows[0]; await pool.query('INSERT INTO customer_sessions(token_hash,customer_id,expires_at) VALUES($1,$2,now()+interval \'7 days\')',[hash(id),customer.id]); if(jar.kimish_session)await pool.query('DELETE FROM customer_sessions WHERE token_hash=$1',[hash(jar.kimish_session)]); } else sessions.set(id, { phone: challenge.phone, expires: now() + 604800000 })
      response.setHeader('Set-Cookie', [cookie('kimish_session', id, 604800), cookie('kimish_challenge', '', 0)])
      return send(200, { user: { phone: challenge.phone } })
    } catch (error) { return send(error.status || 502, { message: error.status ? error.message : 'Verification is temporarily unavailable. Please try again later.' }) }
  }
}
