import express from 'express'
import { httpError } from '../lib/http.js'
import { cartWeight, placeOrder } from '../services/orders.js'
import { loadSettings, shippingMethods } from '../services/settings.js'

// Checkout, shipping quotes and order tracking. Mounted at /api.
export function checkoutRoutes(ctx) {
  const { pool, shiprocket, attempts } = ctx
  const router = express.Router()

  // 20 requests per IP per minute across these public endpoints (counted per server instance)
  router.use(['/orders', '/track', '/shipping'], (req, res, next) => {
    const key = 'public:' + req.socket.remoteAddress
    const old = attempts.get(key)
    const value = old && old.until > Date.now() ? old : { count: 0, until: Date.now() + 60000 }
    value.count++
    attempts.set(key, value)
    if (value.count > 20)
      return res.status(429).json({ message: 'Too many requests. Please try again shortly.' })
    next()
  })

  router.post('/orders', async (req, res) => res.status(201).json(await placeOrder(ctx, req.body)))

  router.post('/shipping/rates', async (req, res) => {
    const { pincode, items, payment } = req.body || {}
    if (!/^\d{6}$/.test(String(pincode || '')))
      throw httpError(400, 'Enter a valid 6-digit PIN code first.')
    if (!Array.isArray(items) || !items.length || items.length > 100)
      throw httpError(400, 'Add products before checking shipping rates.')
    const settings = await loadSettings(pool)
    if (!shippingMethods(settings).includes('shiprocket'))
      throw httpError(400, 'Shiprocket shipping is not available.')
    const weight = await cartWeight(pool, items)
    res.json({
      weight,
      couriers: await shiprocket.rates(String(pincode), weight, payment === 'cod', settings),
    })
  })

  // Order status for customers: needs both the order number and the mobile used at checkout
  router.post('/track', async (req, res) => {
    const { rows } = await pool.query(
      "SELECT order_number,status,tracking_number,created_at FROM orders WHERE order_number=$1 AND customer_snapshot->>'mobile'=$2",
      [String(req.body.orderId || ''), String(req.body.mobile || '')],
    )
    if (!rows[0]) throw httpError(404, 'No matching order found.')
    res.json(rows[0])
  })

  return router
}
