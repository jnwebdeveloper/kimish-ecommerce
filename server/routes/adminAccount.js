import express from 'express'
import { hash, httpError } from '../lib/http.js'
import { adminToken, sessionCookie } from '../middleware/adminSession.js'
import { passwordHash, passwordValid } from '../password.js'

// The signed-in administrator's own session and password. Mounted at /api/admin after requireAdmin.
export function adminAccountRoutes({ pool, origin }) {
  const router = express.Router()

  router.get('/session', (req, res) => res.json({ admin: req.admin }))

  // Changing the password ends every session for this administrator
  router.post('/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body || {}
    if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128)
      throw httpError(400, 'New password must contain 12–128 characters.')
    const user = (await pool.query('SELECT password_hash FROM admins WHERE id=$1', [req.admin.id]))
      .rows[0]
    if (!passwordValid(String(currentPassword || ''), user.password_hash))
      throw httpError(400, 'Current password is incorrect.')
    if (currentPassword === newPassword) throw httpError(400, 'Choose a different password.')
    await pool.query('UPDATE admins SET password_hash=$1 WHERE id=$2', [
      passwordHash(newPassword),
      req.admin.id,
    ])
    await pool.query('DELETE FROM admin_sessions WHERE admin_id=$1', [req.admin.id])
    res.set('Set-Cookie', sessionCookie(origin, '', 0))
    res.json({ message: 'Password changed. Please sign in again.' })
  })

  router.post('/logout', async (req, res) => {
    await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1', [hash(adminToken(req))])
    res.set('Set-Cookie', sessionCookie(origin, '', 0))
    res.json({ ok: true })
  })

  return router
}
