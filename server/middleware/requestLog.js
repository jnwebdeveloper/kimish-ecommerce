import { randomUUID } from 'node:crypto'

// Gives each API request an id (req.id, X-Request-Id header) and a logger tagged with it (req.log),
// then logs one line when the response finishes. Query strings are left out: they can carry tokens.
export const requestLog = (log) => (req, res, next) => {
  const incoming = String(req.headers['x-request-id'] || '')
  req.id = /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID()
  req.log = log.child({ requestId: req.id })
  res.set('X-Request-Id', req.id)
  const started = process.hrtime.bigint()
  res.on('finish', () => {
    const status = res.statusCode
    const fields = {
      method: req.method,
      path: (req.originalUrl || req.url).split('?')[0],
      status,
      ms: Number((process.hrtime.bigint() - started) / 1000000n),
    }
    if (req.admin) fields.adminId = req.admin.id
    // Server faults are errors; refused/limited requests are worth noticing; the rest is routine
    const level = status >= 500 ? 'error' : [403, 429].includes(status) ? 'warn' : 'info'
    req.log[level]('request', fields)
  })
  next()
}
