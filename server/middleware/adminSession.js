import { cookies, hash } from '../lib/http.js'

export const sessionCookie = (origin, value, age) =>
  `kimish_admin=${value}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${age}${origin.startsWith('https:') ? '; Secure' : ''}`

export const adminToken = (req) => cookies(req).kimish_admin

// Loads the signed-in administrator into req.admin, or answers 401
export const requireAdmin = (pool) => async (req, res, next) => {
  const token = adminToken(req)
  if (!token) return res.status(401).json({ message: 'Please sign in as an administrator.' })
  const { rows } = await pool.query(
    'SELECT a.id,a.name,a.email FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=$1 AND s.expires_at>now()',
    [hash(token)],
  )
  if (!rows[0]) return res.status(401).json({ message: 'Session expired. Please sign in again.' })
  req.admin = rows[0]
  next()
}

export const isPrimaryAdmin = (env, admin) =>
  Boolean(env.PRIMARY_ADMIN_EMAIL) &&
  admin.email.toLowerCase() === env.PRIMARY_ADMIN_EMAIL.toLowerCase()

// Administrator accounts and the activity log are limited to the primary administrator
export const guardSensitive = (env) => (req, res, next) => {
  if (['admins', 'audit'].includes(req.params.module) && !isPrimaryAdmin(env, req.admin))
    return res.status(403).json({
      message: 'Only the primary administrator can manage administrators or view security logs.',
    })
  next()
}
