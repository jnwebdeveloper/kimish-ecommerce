import { loadSettings } from './settings.js'

const money = (n) => Math.round(Number(n || 0) * 100) / 100

// Shiprocket wants a local timestamp; orders are placed in India
const istDateTime = (date) =>
  new Date(date).toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16)

// Builds the Shiprocket "create custom order" request for a saved order and its items.
// Shiprocket's order total (and the cash a COD courier collects) is
// sub_total + shipping_charges - total_discount, so all three must match the order.
export function shiprocketOrderPayload(order, items, settings = {}, env = {}) {
  const cust = order.customer_snapshot
  return {
    order_id: order.order_number,
    order_date: istDateTime(order.created_at),
    pickup_location: settings.shiprocket_pickup_location || env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
    billing_customer_name: cust.name,
    billing_last_name: '',
    billing_address: cust.address,
    billing_address_2: cust.landmark || '',
    billing_city: cust.city,
    billing_pincode: cust.pincode,
    billing_state: cust.state,
    billing_country: 'India',
    billing_email: cust.email || settings.support_email || '',
    billing_phone: cust.mobile,
    shipping_is_billing: true,
    order_items: items.map((i) => ({
      name: i.product_name,
      sku: `KIM-${i.variant_id || i.product_id}`,
      units: i.quantity,
      selling_price: money(i.price),
    })),
    payment_method: order.payment === 'cod' ? 'COD' : 'Prepaid',
    sub_total: money(order.subtotal),
    shipping_charges: money(order.shipping),
    total_discount: money(order.discount),
    length: Math.max(...items.map((i) => Number(i.length_cm || 20))),
    breadth: Math.max(...items.map((i) => Number(i.breadth_cm || 20))),
    height: Math.max(...items.map((i) => Number(i.height_cm || 10))),
    weight: Math.max(
      0.5,
      items.reduce((sum, i) => sum + Number(i.weight_kg || 0.5) * Number(i.quantity), 0),
    ),
  }
}

// Creates the Shiprocket order for a placed order (COD right away, prepaid once paid).
// Skips orders already sent and orders shipped another way; records failures on the shipment.
//
// The payment verify call and the Razorpay webhook often trigger this at the same moment. The
// shipment is claimed ('creating') in one atomic UPDATE first, so only one caller ever talks to
// Shiprocket; the other updates no row and stops. A claim left behind by a crash can be taken
// over after CLAIM_TIMEOUT.
const CLAIM_TIMEOUT = '10 minutes'
export async function syncShipment({ pool, env, shiprocket }, orderId) {
  const c = await pool.connect()
  let claimed = false
  try {
    claimed = Boolean(
      (
        await c.query(
          `UPDATE shipments s SET status='creating',updated_at=now() FROM orders o
           WHERE s.order_id=$1 AND o.id=s.order_id AND s.provider='shiprocket' AND s.provider_order_id IS NULL
             AND o.status<>'Cancelled' AND (o.payment='cod' OR o.payment_status='Paid')
             AND (s.status IN ('pending','failed') OR (s.status='creating' AND s.updated_at < now() - interval '${CLAIM_TIMEOUT}'))
           RETURNING s.id`,
          [orderId],
        )
      ).rowCount,
    )
    if (!claimed) return
    const order = (await c.query('SELECT * FROM orders WHERE id=$1', [orderId])).rows[0]
    const items = (
      await c.query(
        'SELECT oi.*,v.weight,v.weight_kg,v.length_cm,v.breadth_cm,v.height_cm FROM order_items oi LEFT JOIN variants v ON v.id=oi.variant_id WHERE oi.order_id=$1',
        [orderId],
      )
    ).rows
    const d = await shiprocket.createOrder(
      shiprocketOrderPayload(order, items, await loadSettings(c), env),
    )
    await c.query(
      "UPDATE shipments SET provider_order_id=$1,shipment_id=$2,status='created',raw_response=$3,updated_at=now() WHERE order_id=$4 AND status='creating'",
      [String(d.order_id || ''), String(d.shipment_id || ''), d, orderId],
    )
  } catch (e) {
    // Only release our own claim; never overwrite a shipment someone else created
    if (claimed)
      await c.query(
        "UPDATE shipments SET status='failed',raw_response=jsonb_build_object('error',$1::text),updated_at=now() WHERE order_id=$2 AND status='creating' AND provider_order_id IS NULL",
        [e.message, orderId],
      )
    throw e
  } finally {
    c.release()
  }
}

// Shipment creation must not delay or fail the customer's request; failures are stored on the
// shipment and logged
export const syncShipmentInBackground = (ctx, orderId) => {
  syncShipment(ctx, orderId).catch((err) =>
    ctx.log.error('Shiprocket shipment creation failed', { orderId, err }),
  )
}
