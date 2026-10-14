import express from 'express'
import { httpError } from '../lib/http.js'
import { cancelUnpaidOrder } from '../services/orders.js'
import { syncShipmentInBackground } from '../services/shipments.js'

// Razorpay Checkout callbacks from the storefront. Mounted at /api.
export function paymentRoutes(ctx) {
  const { pool, razorpay } = ctx
  const router = express.Router()

  // Marks the order paid only after the signature checks out AND Razorpay reports the full amount captured
  router.post('/payments/razorpay/verify', async (req, res) => {
    const { orderNumber, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body || {}
    const order = (await pool.query('SELECT * FROM orders WHERE order_number=$1', [orderNumber]))
      .rows[0]
    if (!order) throw httpError(404, 'Order not found.')
    const payment = (
      await pool.query('SELECT * FROM payments WHERE order_id=$1 AND provider_order_id=$2', [
        order.id,
        razorpay_order_id,
      ])
    ).rows[0]
    if (!payment) throw httpError(400, 'Payment order mismatch.')
    if (!razorpay.validPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature))
      throw httpError(400, 'Payment verification failed.')
    const { ok, data: paid } = await razorpay.fetchPayment(razorpay_payment_id)
    if (
      !ok ||
      paid.order_id !== razorpay_order_id ||
      paid.status !== 'captured' ||
      Number(paid.amount) !== Math.round(Number(order.total) * 100)
    )
      throw httpError(400, 'Payment is not captured yet. Please retry verification shortly.')
    await pool.query(
      "UPDATE payments SET provider_payment_id=$1,status='captured',method=$2,raw_response=$3,updated_at=now() WHERE id=$4",
      [razorpay_payment_id, String(paid.method || ''), paid, payment.id],
    )
    await pool.query("UPDATE orders SET payment_status='Paid' WHERE id=$1", [order.id])
    syncShipmentInBackground(ctx, order.id)
    res.json({ ok: true, orderNumber: order.order_number })
  })

  // The customer closed the payment window: cancel the unpaid order and restore its stock
  router.post('/payments/razorpay/cancel', async (req, res) => {
    const { orderNumber, razorpay_order_id } = req.body || {}
    res.json({ ok: true, cancelled: await cancelUnpaidOrder(ctx, orderNumber, razorpay_order_id) })
  })

  return router
}
