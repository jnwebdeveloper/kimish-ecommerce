import { httpError } from '../lib/http.js'
import { audit } from './audit.js'
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
    pickup_location:
      settings.shiprocket_pickup_location || env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
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

// Order statuses in delivery order; tracking updates only ever move an order forward
const ORDER_STAGES = ['Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered']

// Maps a courier status from Shiprocket (webhook or tracking API) to an order status, or null
// when it doesn't change the order (e.g. "AWB Assigned", "Out For Pickup", RTO, cancellations)
export function orderStageFor(courierStatus) {
  const s = String(courierStatus || '').toUpperCase()
  if (!s || /RTO|RETURN|CANCEL|LOST|DAMAGE|DESTROY|UNDELIVERED|NOT DELIVERED/.test(s)) return null
  if (/DELIVERED/.test(s)) return 'Delivered'
  if (/OUT FOR DELIVERY/.test(s)) return 'Out for Delivery'
  if (/PICKED UP|IN TRANSIT|SHIPPED|REACHED|DISPATCH|DESTINATION|HUB/.test(s)) return 'Shipped'
  return null
}

// Moves the order forward to `stage` (never backwards, never out of Cancelled)
async function advanceOrder(db, orderId, stage) {
  if (!stage) return
  await db.query(
    `UPDATE orders SET status=$2 WHERE id=$1 AND status<>'Cancelled'
       AND array_position($3::text[], status) < array_position($3::text[], $2::text)`,
    [orderId, stage, ORDER_STAGES],
  )
}

// Records a courier status from the Shiprocket webhook or a tracking refresh, and moves the
// order along. Matches the shipment by AWB, falling back to Shiprocket's shipment id.
export async function applyTrackingStatus(
  pool,
  { awb, shipmentId, status, courierName, trackUrl },
) {
  if (!status || (!awb && !shipmentId)) return null
  const delivered = orderStageFor(status) === 'Delivered'
  const row = (
    await pool.query(
      `UPDATE shipments SET status=$3::text, courier_name=coalesce(nullif($4::text,''),courier_name),
         tracking_url=coalesce(nullif($5::text,''),tracking_url),
         awb_code=CASE WHEN awb_code='' THEN $1::text ELSE awb_code END,
         delivered_at=CASE WHEN $6::boolean THEN coalesce(delivered_at,now()) ELSE delivered_at END, updated_at=now()
       WHERE ($1::text<>'' AND awb_code=$1::text) OR ($2::text<>'' AND shipment_id=$2::text)
       RETURNING order_id`,
      [awb || '', String(shipmentId || ''), status, courierName || '', trackUrl || '', delivered],
    )
  ).rows[0]
  if (row) await advanceOrder(pool, row.order_id, orderStageFor(status))
  return row?.order_id ?? null
}

const SHIPMENT_FIELDS = [
  'provider',
  'status',
  'provider_order_id',
  'shipment_id',
  'courier_id',
  'courier_name',
  'awb_code',
  'label_url',
  'tracking_url',
  'pickup_scheduled_at',
  'delivered_at',
  'booking_error',
  'updated_at',
]

// What the admin shipment panel shows for an order
export async function shipmentDetails(pool, orderId) {
  const row = (
    await pool.query(
      `SELECT ${SHIPMENT_FIELDS.map((f) => 's.' + f).join(',')},
         o.status order_status,o.payment,o.payment_status,o.total
       FROM orders o LEFT JOIN shipments s ON s.order_id=o.id WHERE o.id=$1`,
      [orderId],
    )
  ).rows[0]
  if (!row) throw httpError(404, 'Order not found.')
  return row
}

// No courier chosen (older/manual orders, or "Ship with any courier"): try the couriers that serve
// the delivery PIN code, cheapest first, until one books. Leaving the choice to Shiprocket picks
// the account default, which may not be bookable for this parcel.
const COURIER_ATTEMPTS = 3
async function bookCheapestCourier({ pool, env, shiprocket }, orderId, shipmentId) {
  const order = (await pool.query('SELECT * FROM orders WHERE id=$1', [orderId])).rows[0]
  const items = (
    await pool.query(
      'SELECT oi.*,v.weight_kg,v.length_cm,v.breadth_cm,v.height_cm FROM order_items oi LEFT JOIN variants v ON v.id=oi.variant_id WHERE oi.order_id=$1',
      [orderId],
    )
  ).rows
  const settings = await loadSettings(pool)
  const { weight } = shiprocketOrderPayload(order, items, settings, env)
  const couriers = await shiprocket.rates(
    order.customer_snapshot.pincode,
    weight,
    order.payment === 'cod',
    settings,
  )
  if (!couriers.length) throw new Error('No courier serves this PIN code.')
  const failures = []
  for (const c of couriers.slice(0, COURIER_ATTEMPTS)) {
    try {
      return await shiprocket.assignAwb(shipmentId, c.id)
    } catch (e) {
      failures.push(`${c.name}: ${e.message.replace(/^Shiprocket: /, '')}`)
    }
  }
  throw new Error(`Shiprocket: no courier could be booked (${failures.join('; ')}).`)
}

// The admin "Ship" button: makes sure the Shiprocket order exists, books the courier the
// customer chose (AWB), requests pickup and fetches the label. Each finished step is saved
// straight away, so pressing Ship again after a failure continues where it stopped.
// anyCourier lets Shiprocket choose when the chosen courier can no longer take the parcel.
export async function shipOrder(ctx, orderId, admin, { anyCourier = false } = {}) {
  const { pool, shiprocket } = ctx
  const lock = await pool.connect()
  try {
    // One Ship at a time per order (double clicks, two admins)
    const { locked } = (await lock.query('SELECT pg_try_advisory_lock(7467, $1) locked', [orderId]))
      .rows[0]
    if (!locked) throw httpError(409, 'This order is already being shipped. Refresh in a moment.')
    try {
      let s = await shipmentDetails(pool, orderId)
      if (s.provider !== 'shiprocket')
        throw httpError(400, 'This order is not shipped with Shiprocket.')
      if (s.order_status === 'Cancelled') throw httpError(400, 'This order is cancelled.')
      if (s.payment !== 'cod' && s.payment_status !== 'Paid')
        throw httpError(400, 'Online orders can be shipped only after payment.')
      const save = (sql, params) =>
        pool.query(
          `UPDATE shipments SET ${sql},booking_error='',updated_at=now() WHERE order_id=$1`,
          [orderId, ...params],
        )
      try {
        if (!s.provider_order_id) {
          await syncShipment(ctx, orderId)
          s = await shipmentDetails(pool, orderId)
          if (!s.provider_order_id) throw new Error('The Shiprocket order could not be created.')
        }
        if (!s.awb_code) {
          const chosen = anyCourier ? '' : s.courier_id
          let booked
          if (chosen) {
            try {
              booked = await shiprocket.assignAwb(s.shipment_id, chosen)
            } catch (e) {
              throw Object.assign(e, { courierUnavailable: true })
            }
          } else booked = await bookCheapestCourier(ctx, orderId, s.shipment_id)
          await save(
            "awb_code=$2::text,courier_id=$3::text,courier_name=coalesce(nullif($4::text,''),courier_name),status='awb_assigned'",
            [booked.awb, booked.courierId, booked.courierName],
          )
          await pool.query('UPDATE orders SET tracking_number=$2::text WHERE id=$1', [
            orderId,
            booked.awb,
          ])
          s = await shipmentDetails(pool, orderId)
        }
        // Label before pickup: the label only needs the AWB, so a failing pickup request
        // doesn't stop the parcel being packed and labelled
        if (!s.label_url) {
          const { labelUrl } = await shiprocket.generateLabel(s.shipment_id)
          await save('label_url=$2::text', [labelUrl])
        }
        if (!s.pickup_scheduled_at) {
          const { scheduledAt } = await shiprocket.requestPickup(s.shipment_id)
          const when = scheduledAt && !Number.isNaN(Date.parse(scheduledAt)) ? scheduledAt : null
          await save(
            "pickup_scheduled_at=coalesce($2::timestamptz,now()),status='pickup_scheduled'",
            [when],
          )
        }
        await advanceOrder(pool, orderId, 'Packed')
        await audit(pool, admin, 'ship', 'orders', orderId)
      } catch (e) {
        if (e.status) throw e
        await pool.query(
          'UPDATE shipments SET booking_error=$2::text,updated_at=now() WHERE order_id=$1',
          [orderId, e.message],
        )
        ctx.log?.warn('Shiprocket booking failed', { orderId, reason: e.message })
        throw httpError(
          502,
          e.courierUnavailable
            ? `${s.courier_name || 'The chosen courier'} could not be booked. ${e.message}`
            : e.message,
          e.courierUnavailable ? { code: 'courier_unavailable' } : undefined,
        )
      }
      return shipmentDetails(pool, orderId)
    } finally {
      await lock.query('SELECT pg_advisory_unlock(7467, $1)', [orderId])
    }
  } finally {
    lock.release()
  }
}

// Fetches the latest courier status for a booked shipment and applies it like a webhook would
export async function refreshTracking(ctx, orderId) {
  const s = await shipmentDetails(ctx.pool, orderId)
  if (!s.awb_code) throw httpError(400, 'Ship the order first; it has no tracking number yet.')
  let t
  try {
    t = await ctx.shiprocket.track(s.awb_code)
  } catch (e) {
    throw httpError(502, e.message)
  }
  if (t.status)
    await applyTrackingStatus(ctx.pool, { awb: s.awb_code, status: t.status, trackUrl: t.trackUrl })
  return {
    shipment: await shipmentDetails(ctx.pool, orderId),
    activities: t.activities,
    note: t.error,
  }
}
