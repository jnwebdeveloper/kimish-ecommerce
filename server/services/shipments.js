import { loadSettings } from './settings.js'

// Creates the Shiprocket order for a placed order (COD right away, prepaid once paid).
// Skips orders already sent and orders shipped another way; records failures on the shipment.
export async function syncShipment({ pool, env, shiprocket }, orderId) {
  const c = await pool.connect()
  try {
    const order = (await c.query('SELECT * FROM orders WHERE id=$1', [orderId])).rows[0]
    if (!order) return
    const existing = (await c.query('SELECT * FROM shipments WHERE order_id=$1', [orderId])).rows[0]
    if (existing?.provider_order_id || (existing && existing.provider !== 'shiprocket')) return
    const items = (
      await c.query(
        'SELECT oi.*,v.weight,v.weight_kg,v.length_cm,v.breadth_cm,v.height_cm FROM order_items oi LEFT JOIN variants v ON v.id=oi.variant_id WHERE oi.order_id=$1',
        [orderId],
      )
    ).rows
    const cust = order.customer_snapshot
    const d = await shiprocket.createOrder({
      order_id: order.order_number,
      order_date: new Date(order.created_at).toISOString().slice(0, 19).replace('T', ' '),
      pickup_location:
        (await loadSettings(c)).shiprocket_pickup_location ||
        env.SHIPROCKET_PICKUP_LOCATION ||
        'Primary',
      billing_customer_name: cust.name,
      billing_last_name: '',
      billing_address: cust.address,
      billing_address_2: cust.landmark || '',
      billing_city: cust.city,
      billing_pincode: cust.pincode,
      billing_state: cust.state,
      billing_country: 'India',
      billing_email: cust.email || 'orders@kimish.local',
      billing_phone: cust.mobile,
      shipping_is_billing: true,
      order_items: items.map((i) => ({
        name: i.product_name,
        sku: `KIM-${i.variant_id || i.product_id}`,
        units: i.quantity,
        selling_price: Number(i.price),
      })),
      payment_method: order.payment === 'cod' ? 'COD' : 'Prepaid',
      sub_total: Number(order.subtotal),
      length: Math.max(...items.map((i) => Number(i.length_cm || 20))),
      breadth: Math.max(...items.map((i) => Number(i.breadth_cm || 20))),
      height: Math.max(...items.map((i) => Number(i.height_cm || 10))),
      weight: Math.max(
        0.5,
        items.reduce((sum, i) => sum + Number(i.weight_kg || 0.5) * Number(i.quantity), 0),
      ),
    })
    await c.query(
      "UPDATE shipments SET provider_order_id=$1,shipment_id=$2,status='created',raw_response=$3,updated_at=now() WHERE order_id=$4",
      [String(d.order_id || ''), String(d.shipment_id || ''), d, orderId],
    )
  } catch (e) {
    await c.query(
      "UPDATE shipments SET status='failed',raw_response=jsonb_build_object('error',$1),updated_at=now() WHERE order_id=$2",
      [e.message, orderId],
    )
    throw e
  } finally {
    c.release()
  }
}

// Shipment creation must not delay or fail the customer's request; failures are stored on the shipment
export const syncShipmentInBackground = (ctx, orderId) => {
  syncShipment(ctx, orderId).catch(() => {})
}
