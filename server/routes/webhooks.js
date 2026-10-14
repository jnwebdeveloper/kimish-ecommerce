import express from 'express'
import { syncShipmentInBackground } from '../services/shipments.js'

const logEvent = (pool, provider, type, externalId, payload) =>
  pool.query(
    'INSERT INTO integration_events(provider,event_type,external_id,payload,processed) VALUES($1,$2,$3,$4,true)',
    [provider, type, externalId, payload],
  )

// Server-to-server notifications, verified by signature/secret instead of the origin check.
// Mounted at /api.
export function webhookRoutes(ctx) {
  const { pool, env, razorpay } = ctx
  const router = express.Router()

  router.post('/webhooks/razorpay', async (req, res) => {
    if (!env.RAZORPAY_WEBHOOK_SECRET) return res.sendStatus(503)
    if (!razorpay.validWebhookSignature(req.rawBody, req.headers['x-razorpay-signature']))
      return res.sendStatus(401)
    const event = req.body || {}
    await logEvent(
      pool,
      'razorpay',
      String(event.event || 'unknown'),
      String(event.payload?.payment?.entity?.id || ''),
      event,
    )
    const pay = event.payload?.payment?.entity
    if (pay?.order_id) {
      const status =
        pay.status === 'captured' ? 'captured' : pay.status === 'failed' ? 'failed' : 'authorized'
      await pool.query(
        'UPDATE payments SET provider_payment_id=coalesce($1,provider_payment_id),status=$2,raw_response=$3,updated_at=now() WHERE provider_order_id=$4',
        [pay.id || null, status, pay, pay.order_id],
      )
      if (status === 'captured') {
        const row = (
          await pool.query(
            "UPDATE orders o SET payment_status='Paid' FROM payments p WHERE p.order_id=o.id AND p.provider_order_id=$1 RETURNING o.id",
            [pay.order_id],
          )
        ).rows[0]
        if (row) syncShipmentInBackground(ctx, row.id)
      }
    }
    res.json({ ok: true })
  })

  router.post('/webhooks/shiprocket', async (req, res) => {
    const secret = String(req.headers['x-api-key'] || req.headers['x-shiprocket-token'] || '')
    if (env.SHIPROCKET_WEBHOOK_SECRET && secret !== env.SHIPROCKET_WEBHOOK_SECRET)
      return res.sendStatus(401)
    const body = req.body || {}
    const awb = String(body.awb || body.awb_code || '')
    await logEvent(
      pool,
      'shiprocket',
      String(body.current_status || body.status || 'update'),
      awb,
      body,
    )
    if (awb)
      await pool.query(
        "UPDATE shipments SET awb_code=$1,status=$2,courier_name=coalesce(nullif($3,''),courier_name),updated_at=now() WHERE awb_code=$1 OR shipment_id=$4",
        [
          awb,
          String(body.current_status || body.status || 'updated'),
          String(body.courier_name || ''),
          String(body.shipment_id || ''),
        ],
      )
    res.json({ ok: true })
  })

  return router
}
