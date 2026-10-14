import { createHash } from 'node:crypto'

// Throw from any route or service; the error handler turns it into { message, ...details }
export const httpError = (status, message, details) =>
  Object.assign(new Error(message), { status, details })

export const hash = (value) => createHash('sha256').update(value).digest('hex')

export const cookies = (req) =>
  Object.fromEntries((req.headers.cookie || '').split(';').map((s) => s.trim().split('=')))

// Behind Vercel's proxy the socket address is the proxy's; Vercel sets x-real-ip to the client address
export const clientIp = (req, env) =>
  (env.VERCEL && req.headers['x-real-ip']) || req.socket.remoteAddress || 'unknown'

// Runs fn(client) in a transaction: commits when it returns, rolls back when it throws
export async function withTransaction(pool, fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
