import express from 'express'
import { resolve } from 'node:path'
import { createApi } from './api.js'
import { createAuthHandler } from './auth.js'
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
const server = api.listen(Number(process.env.PORT || 3000), '127.0.0.1', () =>
  console.log('Kimish server ready on port ' + (process.env.PORT || 3000)),
)
process.on('SIGTERM', () => server.close(() => pool.end()))
