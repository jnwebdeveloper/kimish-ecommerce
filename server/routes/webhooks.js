import express from 'express'
import { applyTrackingStatus, syncShipmentInBackground } from '../services/shipments.js'

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

  // Courier tracking updates. Shiprocket refuses webhook URLs containing words like "shiprocket"
  // or "sr", so configure https://YOUR-DOMAIN/api/webhooks/courier-updates in Shiprocket; the
  // older /webhooks/shiprocket path keeps working.
  const shiprocketWebhook = async (req, res) => {
    const secret = String(req.headers['x-api-key'] || req.headers['x-shiprocket-token'] || '')
    if (env.SHIPROCKET_WEBHOOK_SECRET && secret !== env.SHIPROCKET_WEBHOOK_SECRET)
      return res.sendStatus(401)
    const body = req.body || {}
    const awb = String(body.awb || body.awb_code || '')
    const status = String(body.current_status || body.shipment_status || body.status || '')
    await logEvent(pool, 'shiprocket', status || 'update', awb, body)
    await applyTrackingStatus(pool, {
      awb,
      shipmentId: body.shipment_id,
      status,
      courierName: String(body.courier_name || ''),
    })
    // Always 200: Shiprocket disables webhooks that keep failing
    res.json({ ok: true })
  }
  router.post('/webhooks/courier-updates', shiprocketWebhook)
  router.post('/webhooks/shiprocket', shiprocketWebhook)

  return router
}
