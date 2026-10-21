import { createHash } from 'node:crypto'
import { httpError } from '../lib/http.js'

// The /api/auth/checkout path receives the existing HttpOnly session cookie.
// Neither delivery details nor a client-supplied customer ID establish ownership.
export async function checkoutCustomer(pool, request) {
  const sessionToken = (request.headers.cookie || '')
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('kimish_session='))
    ?.slice('kimish_session='.length)
  if (!sessionToken) throw httpError(401, 'Please sign in again before placing your order.')
  const customer = (
    await pool.query(
      'SELECT c.id FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=$1 AND s.expires_at>now()',
      [createHash('sha256').update(sessionToken).digest('hex')],
    )
  ).rows[0]
  if (!customer)
    throw httpError(
      401,
      'Your session has expired. Please sign in again before placing your order.',
    )
  return customer
}
