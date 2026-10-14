import { createHmac, timingSafeEqual } from 'node:crypto'
import { httpError } from '../lib/http.js'

const sameSignature = (expected, received) => {
  const a = Buffer.from(expected),
    b = Buffer.from(String(received || ''))
  return a.length === b.length && timingSafeEqual(a, b)
}

// Razorpay Orders/Payments API. The key secret stays on the server; the browser only gets keyId.
export function createRazorpay(env) {
  const configured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)
  const auth = () =>
    'Basic ' + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')
  const get = async (path) => {
    const response = await fetch('https://api.razorpay.com/v1/' + path, {
      headers: { Authorization: auth() },
    })
    return { ok: response.ok, data: await response.json() }
  }

  return {
    configured,
    keyId: env.RAZORPAY_KEY_ID,
    async createOrder({ amount, receipt, notes }) {
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { Authorization: auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency: 'INR', receipt, notes }),
      })
      const data = await response.json()
      if (!response.ok) throw httpError(502, 'Unable to start Razorpay payment.')
      return data
    },
    fetchPayment: (paymentId) => get('payments/' + encodeURIComponent(paymentId)),
    orderPayments: (orderId) => get(`orders/${encodeURIComponent(String(orderId))}/payments`),
    // Signature from the Checkout success handler
    validPaymentSignature: (orderId, paymentId, signature) =>
      sameSignature(
        createHmac('sha256', env.RAZORPAY_KEY_SECRET)
          .update(`${orderId}|${paymentId}`)
          .digest('hex'),
        signature,
      ),
    validWebhookSignature: (rawBody, signature) =>
      Boolean(env.RAZORPAY_WEBHOOK_SECRET) &&
      sameSignature(
        createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
          .update(rawBody || Buffer.from(''))
          .digest('hex'),
        signature,
      ),
  }
}
