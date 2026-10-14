import express from 'express'

export function securityHeaders(_req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  })
  next()
}

// JSON bodies up to 100 KB; the raw bytes are kept for webhook signature checks
export const jsonBody = express.json({
  limit: '100kb',
  verify: (req, _res, buf) => {
    req.rawBody = buf
  },
})

export function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store')
  next()
}

// Blocks cross-site writes: non-GET API requests must come from the storefront's own origin.
// Webhooks are exempt (providers call them server-to-server and are verified by signature).
export const sameOriginWrites = (origin) => (req, res, next) => {
  if (req.path.startsWith('/webhooks/')) return next()
  if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin)
    return res.status(403).json({ message: 'Request origin is not allowed.' })
  next()
}
