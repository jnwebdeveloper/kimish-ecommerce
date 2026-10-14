import { clientIp } from '../lib/http.js'
import { hitRateLimit } from '../lib/rateLimit.js'

// Per-client-IP limit shared across server instances, e.g. rateLimit({ ..., name: 'public', max: 20, windowMs: 60000 })
export const rateLimit =
  ({ pool, env, name, max, windowMs, message }) =>
  async (req, res, next) => {
    if ((await hitRateLimit(pool, `${name}:${clientIp(req, env)}`, windowMs)) > max)
      return res.status(429).json({ message })
    next()
  }
