import express from 'express'
import { storeCatalog } from '../services/catalog.js'

// Public read-only routes. Mounted at /api.
export function storeRoutes({ pool }) {
  const router = express.Router()

  router.get('/health', async (_req, res) => {
    await pool.query('SELECT 1')
    res.json({ database: 'connected' })
  })

  router.get('/store', async (_req, res) => res.json(await storeCatalog(pool)))

  return router
}
