import express from 'express'
import { httpError, withTransaction } from '../lib/http.js'
import { updateOrder } from '../services/adminRecords.js'
import { audit } from '../services/audit.js'
import { placeOrder } from '../services/orders.js'
import { loadSettings, saveSettings } from '../services/settings.js'
import { refreshTracking, shipOrder, shipmentDetails } from '../services/shipments.js'

// Admin order actions and the Shiprocket pickup address. Mounted at /api/admin after requireAdmin,
// before the generic records router (PUT /orders/:id must win over PUT /:module/:id).
export function adminOrderRoutes(ctx) {
  const { pool, shiprocket } = ctx
  const router = express.Router()

  router.put('/orders/:id', async (req, res) =>
    res.json(await updateOrder(pool, req.admin, req.params.id, req.body)),
  )

  // Shipment panel in the order details: status, courier booking ("Ship") and tracking refresh
  const orderId = (req) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw httpError(400, 'Invalid order.')
    return id
  }
  router.get('/orders/:id/shipment', async (req, res) =>
    res.json(await shipmentDetails(pool, orderId(req))),
  )
  router.post('/orders/:id/ship', async (req, res) =>
    res.json(
      await shipOrder(ctx, orderId(req), req.admin, { anyCourier: req.body?.anyCourier === true }),
    ),
  )
  router.post('/orders/:id/shipment/track', async (req, res) =>
    res.json(await refreshTracking(ctx, orderId(req))),
  )

  // Manual order from the admin panel (same pricing and stock rules as checkout)
  router.post('/create/order', async (req, res) =>
    res.status(201).json(await placeOrder(ctx, req.body, req.admin)),
  )

  router.get('/shiprocket/pickups', async (_req, res) => {
    const settings = await loadSettings(pool)
    res.json({
      selected: settings.shiprocket_pickup_location || '',
      addresses: await shiprocket.pickups(),
    })
  })

  // Saves which Shiprocket pickup address (and its PIN code, for rate quotes) the store ships from
  router.post('/shiprocket/pickups', async (req, res) => {
    const pickup = (await shiprocket.pickups()).find(
      (a) => a.location === String(req.body?.location || ''),
    )
    if (!pickup) throw httpError(400, 'Choose one of your Shiprocket pickup addresses.')
    await withTransaction(pool, async (c) => {
      await saveSettings(c, [
        [
          'shiprocket_pickup_location',
          pickup.location,
          'Shiprocket pickup address nickname (set from the Shiprocket pickup panel)',
        ],
        [
          'shiprocket_pickup_pincode',
          pickup.pincode,
          'PIN code of the Shiprocket pickup address, used for rate estimates',
        ],
      ])
      await audit(c, req.admin, 'update', 'settings', 'shiprocket_pickup')
    })
    res.json({ selected: pickup.location })
  })

  return router
}
