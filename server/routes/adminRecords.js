import express from 'express'
import { presignImage } from '../integrations/r2.js'
import { httpError } from '../lib/http.js'
import { guardSensitive, isPrimaryAdmin } from '../middleware/adminSession.js'
import { modules } from '../modules.js'
import { deleteRecord, listRecords, saveRecord } from '../services/adminRecords.js'

// Admin screens' data. Mounted at /api/admin after requireAdmin, and after the more specific
// admin routers: /:module would otherwise also match paths like /session.
export function adminRecordRoutes({ pool, env }) {
  const router = express.Router()
  const guard = guardSensitive(env)

  router.get('/meta', (_req, res) => res.json(modules))

  router.get('/overview', async (_req, res) => {
    const { rows } = await pool.query(
      "SELECT (SELECT count(*) FROM products) products,(SELECT count(*) FROM orders) orders,(SELECT count(*) FROM customers) customers,(SELECT coalesce(sum(total),0) FROM orders WHERE payment_status='Paid' AND status!='Cancelled') revenue,(SELECT count(*) FROM variants WHERE stock<10) low_stock",
    )
    res.json(rows[0])
  })

  router.get('/audit', async (req, res) => {
    if (!isPrimaryAdmin(env, req.admin))
      throw httpError(403, 'Only the primary administrator may view audit logs.')
    res.json((await pool.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100')).rows)
  })

  // Signed URL for uploading a product/banner image straight to Cloudflare R2
  router.post('/images/presign', async (req, res) => {
    try {
      res.json(await presignImage(env, req.body || {}))
    } catch (e) {
      throw httpError(e.status || 500, e.status ? e.message : 'Could not prepare image upload.')
    }
  })

  router.get('/:module', guard, async (req, res) =>
    res.json(await listRecords(pool, req.params.module)),
  )
  router.post('/:module', guard, async (req, res) =>
    res.json(await saveRecord(pool, req.admin, req.params.module, null, req.body)),
  )
  router.put('/:module/:id', guard, async (req, res) =>
    res.json(await saveRecord(pool, req.admin, req.params.module, req.params.id, req.body)),
  )
  router.delete('/:module/:id', guard, async (req, res) => {
    await deleteRecord(pool, req.admin, req.params.module, Number(req.params.id))
    res.json({ ok: true })
  })

  return router
}
