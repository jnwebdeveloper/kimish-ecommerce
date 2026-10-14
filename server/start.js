import express from 'express'
import { resolve } from 'node:path'
import { createApi } from './api.js'
import { createAuthHandler } from './auth.js'
import { createLogger } from './lib/logger.js'
try {
  process.loadEnvFile('.env')
} catch {
  // .env is optional: hosts like Vercel inject environment variables directly
}
const { api, pool } = createApi(process.env)
api.use(createAuthHandler({ env: process.env, pool }))
api.use(express.static(resolve('dist')))
api.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'Not found' })
  res.sendFile(resolve(/^\/admin(\/|$)/.test(req.path) ? 'dist/admin.html' : 'dist/index.html'))
})
const port = Number(process.env.PORT || 3000)
const server = api.listen(port, '127.0.0.1', () =>
  createLogger(process.env).info('Kimish server ready', { port }),
)
process.on('SIGTERM', () => server.close(() => pool.end()))
