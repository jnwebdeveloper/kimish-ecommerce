import express from 'express'
import { randomBytes } from 'node:crypto'
import { passwordResetConfigured, sendPasswordReset } from '../integrations/email.js'
import { hash, httpError, withTransaction } from '../lib/http.js'
import { sessionCookie } from '../middleware/adminSession.js'
import { passwordHash, passwordValid } from '../password.js'

// Admin sign-in and password recovery (no session required). Mounted at /api/admin.
export function adminAuthRoutes({ pool, env, origin, attempts }) {
  const router = express.Router()

  // 8 attempts per IP per 15 minutes (counted per server instance); a successful sign-in resets the count
  router.post('/login', async (req, res) => {
    const ip = req.socket.remoteAddress
    const previous = attempts.get(ip)
    const attempt =
      previous && previous.until > Date.now() ? previous : { count: 0, until: Date.now() + 900000 }
    if (attempt.count >= 8) throw httpError(429, 'Too many attempts. Try again in 15 minutes.')
    attempt.count++
    attempts.set(ip, attempt)
    const admin = (
      await pool.query('SELECT * FROM admins WHERE lower(email)=lower($1)', [
        String(req.body.email || ''),
      ])
    ).rows[0]
    if (!admin || !passwordValid(String(req.body.password || ''), admin.password_hash))
      throw httpError(401, 'Incorrect email or password.')
    attempts.delete(ip)
    const token = randomBytes(32).toString('hex')
    await pool.query(
      "INSERT INTO admin_sessions(token_hash,admin_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
      [hash(token), admin.id],
    )
    res.set('Set-Cookie', sessionCookie(origin, token, 28800))
    res.json({ admin: { id: admin.id, name: admin.name, email: admin.email } })
  })

  // Always answers the same way for known and unknown emails; 5 requests per IP per hour (per instance)
  router.post('/forgot-password', async (req, res) => {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase()
    const key = 'reset:' + req.socket.remoteAddress
    const entry = attempts.get(key) || { count: 0, until: Date.now() + 3600000 }
    if (entry.until < Date.now()) {
      entry.count = 0
      entry.until = Date.now() + 3600000
    }
    entry.count++
    attempts.set(key, entry)
    if (entry.count > 5) throw httpError(429, 'Too many requests. Try again later.')
    const generic = { message: 'If this email is registered, a password reset link will be sent.' }
    if (!passwordResetConfigured(env))
      throw httpError(503, 'Password recovery email is not configured.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json(generic)
    const admin = (await pool.query('SELECT id,email FROM admins WHERE lower(email)=$1', [email]))
      .rows[0]
    if (admin) {
      const token = randomBytes(32).toString('hex')
      await pool.query(
        "INSERT INTO admin_password_resets(admin_id,token_hash,expires_at) VALUES($1,$2,now()+interval '20 minutes')",
        [admin.id, hash(token)],
      )
      const link = new URL('/admin/reset-password', env.PUBLIC_SITE_URL)
      link.searchParams.set('token', token)
      if (!(await sendPasswordReset(env, admin.email, link, req.log)))
        throw httpError(503, 'Password recovery email could not be sent. Please retry later.')
    }
    res.json(generic)
  })

  // Single-use, 20-minute tokens; a reset signs the administrator out everywhere
  router.post('/reset-password', async (req, res) => {
    const token = String(req.body?.token || ''),
      password = req.body?.password
    if (
      !/^[a-f0-9]{64}$/.test(token) ||
      typeof password !== 'string' ||
      password.length < 12 ||
      password.length > 128
    )
      throw httpError(400, 'Invalid reset token or password (12–128 characters required).')
    await withTransaction(pool, async (c) => {
      const row = (
        await c.query(
          'SELECT admin_id FROM admin_password_resets WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',
          [hash(token)],
        )
      ).rows[0]
      if (!row) throw httpError(400, 'Reset link is invalid or expired.')
      await c.query('UPDATE admins SET password_hash=$1 WHERE id=$2', [
        passwordHash(password),
        row.admin_id,
      ])
      await c.query(
        'UPDATE admin_password_resets SET used_at=now() WHERE admin_id=$1 AND used_at IS NULL',
        [row.admin_id],
      )
      await c.query('DELETE FROM admin_sessions WHERE admin_id=$1', [row.admin_id])
    })
    res.json({ message: 'Password updated. Sign in again.' })
  })

  return router
}
