import { randomBytes } from 'node:crypto'
import { validateDelivery } from '../../src/data/deliveryValidation.js'
import { httpError, withTransaction } from '../lib/http.js'
import { audit } from './audit.js'
import { loadSettings, shippingMethods } from './settings.js'
import { syncShipmentInBackground } from './shipments.js'

// Merges cart lines into { variantId: quantity }, rejecting invalid ids and quantities
function cartQuantities(items) {
  const quantities = new Map()
  for (const item of items) {
    const id = Number(item.variantId || item.variant?.id),
      qty = Number(item.qty)
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 100)
      throw httpError(400, 'Invalid item quantity.')
    quantities.set(id, (quantities.get(id) || 0) + qty)
  }
  return quantities
}

// Shipping weight in kg (at least 0.5) from each variant's weight_kg
export async function cartWeight(pool, items) {
  const quantities = cartQuantities(items)
  const rows = (
    await pool.query('SELECT id,weight_kg FROM variants WHERE id=ANY($1::int[])', [
      [...quantities.keys()],
    ])
  ).rows
  if (rows.length !== quantities.size) throw httpError(400, 'An item is unavailable.')
  return Math.max(
    0.5,
    Math.round(
      rows.reduce((sum, v) => sum + Number(v.weight_kg || 0.5) * quantities.get(v.id), 0) * 1000,
    ) / 1000,
  )
}

export const restoreStock = (client, orderId) =>
  client.query(
    'UPDATE variants v SET stock=stock+i.quantity FROM order_items i WHERE i.variant_id=v.id AND i.order_id=$1',
    [orderId],
  )

function checkOrderRequest(body, razorpay) {
  const cust = body.customer || {},
    items = body.items
  const deliveryErrors = validateDelivery(cust)
  if (Object.keys(deliveryErrors).length)
    throw httpError(400, 'Please correct the delivery information.', { fields: deliveryErrors })
  if (
    !cust.name ||
    !/^\d{10}$/.test(cust.mobile) ||
    !/^\d{6}$/.test(cust.pincode) ||
    !cust.address ||
    !cust.city ||
    !cust.state ||
    !Array.isArray(items) ||
    !items.length ||
    items.length > 100
  )
    throw httpError(400, 'Complete the delivery information and add products.')
  if (!['cod', 'razorpay'].includes(body.payment))
    throw httpError(400, 'Choose Cash on Delivery or Razorpay.')
  if (body.payment === 'razorpay' && !razorpay.configured)
    throw httpError(503, 'Online payment is temporarily unavailable.')
}

// Re-checks the courier and rate the customer chose, so the charged shipping matches the quote
async function confirmShippingQuote({ pool, shiprocket }, body) {
  const method = body.shippingMethod
  if (method === undefined) return null
  const settings = await loadSettings(pool)
  if (!shippingMethods(settings).includes(method))
    throw httpError(400, 'Choose an available shipping method.')
  if (method !== 'shiprocket') return null
  const couriers = await shiprocket.rates(
    body.customer.pincode,
    await cartWeight(pool, body.items),
    body.payment === 'cod',
    settings,
  )
  const quote = couriers.find((x) => x.id === String(body.courierId || ''))
  if (!quote)
    throw httpError(
      400,
      'The selected courier is not available for this PIN code. Check shipping rates again.',
    )
  if (Number(body.shippingQuote) !== quote.rate)
    throw httpError(
      409,
      `The shipping rate is now ₹${quote.rate}. Check shipping rates again before placing your order.`,
    )
  return quote
}

// Places a storefront or manual (admin) order in one transaction: locks and decrements stock,
// applies the coupon, prices shipping, saves customer/address/order/items, and starts the
// Razorpay payment when paying online. Prices and totals always come from the database.
export async function placeOrder(ctx, body, admin = null) {
  const { pool, razorpay } = ctx
  checkOrderRequest(body, razorpay)
  const cust = body.customer,
    method = body.shippingMethod
  const quote = await confirmShippingQuote(ctx, body)

  const result = await withTransaction(pool, async (c) => {
    let subtotal = 0
    const saved = []
    // Lock variants in id order so concurrent checkouts can't deadlock
    for (const [id, qty] of [...cartQuantities(body.items)].sort((a, b) => a[0] - b[0])) {
      const v = (
        await c.query(
          'SELECT v.*,p.name,p.image,p.slug,p.active FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=$1 FOR UPDATE OF v',
          [id],
        )
      ).rows[0]
      if (!v || !v.active || v.stock < qty)
        throw httpError(400, 'An item is unavailable or has insufficient stock.')
      await c.query('UPDATE variants SET stock=stock-$1 WHERE id=$2 AND stock >= $1', [qty, id])
      subtotal += Number(v.price) * qty
      saved.push({ v, qty })
    }
    const settings = await loadSettings(c)
    let discount = 0
    const couponCode = String(body.couponCode || '').toUpperCase()
    if (couponCode) {
      const coupon = (
        await c.query('SELECT * FROM coupons WHERE code=$1 AND active=true', [couponCode])
      ).rows[0]
      if (!coupon || subtotal < Number(coupon.min_cart))
        throw httpError(400, 'Coupon is invalid or the minimum order has not been reached.')
      discount =
        coupon.type === 'percent'
          ? Math.round(subtotal * Number(coupon.value)) / 100
          : Number(coupon.value)
      discount = Math.min(discount, subtotal)
    }
    const shipping =
      method === 'none'
        ? 0
        : quote
          ? quote.rate
          : subtotal >= Number(settings.free_shipping_threshold || 499)
            ? 0
            : Number(settings.shipping_fee || 79)
    const total = Math.max(0, subtotal - discount + shipping)
    const customer = (
      await c.query(
        'INSERT INTO customers(name,phone,email) VALUES($1,$2,$3) ON CONFLICT(phone) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email RETURNING id',
        [cust.name, '+91' + cust.mobile, cust.email || ''],
      )
    ).rows[0]
    await c.query(
      'INSERT INTO addresses(customer_id,address,landmark,city,state,pincode) VALUES($1,$2,$3,$4,$5,$6)',
      [customer.id, cust.address, cust.landmark || '', cust.city, cust.state, cust.pincode],
    )
    const number = `KIM${Date.now()}${randomBytes(2).toString('hex').toUpperCase()}`
    const order = (
      await c.query(
        'INSERT INTO orders(order_number,customer_id,payment,subtotal,discount,shipping,total,customer_snapshot,coupon_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [
          number,
          customer.id,
          body.payment,
          subtotal,
          discount,
          shipping,
          total,
          JSON.stringify(cust),
          couponCode || null,
        ],
      )
    ).rows[0]
    for (const { v, qty } of saved)
      await c.query(
        'INSERT INTO order_items(order_id,product_id,variant_id,product_name,weight,price,quantity) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [order.id, v.product_id, v.id, v.name, v.weight, v.price, qty],
      )
    let checkout = null
    if (body.payment === 'razorpay') {
      const data = await razorpay.createOrder({
        amount: Math.round(total * 100),
        receipt: number,
        notes: { kimish_order_id: String(order.id), order_number: number },
      })
      await c.query(
        'INSERT INTO payments(order_id,provider_order_id,amount,status,raw_response) VALUES($1,$2,$3,$4,$5)',
        [order.id, data.id, total, 'created', data],
      )
      checkout = {
        keyId: razorpay.keyId,
        orderId: data.id,
        amount: data.amount,
        currency: data.currency,
        name: 'Kimish',
        description: `Order ${number}`,
      }
    } else
      await c.query(
        "INSERT INTO payments(order_id,amount,status,method) VALUES($1,$2,'created','cod')",
        [order.id, total],
      )
    await c.query(
      "INSERT INTO shipments(order_id,provider,courier_name,courier_id,status) VALUES($1,$2,$3,$4,'pending') ON CONFLICT(order_id) DO NOTHING",
      [
        order.id,
        method === 'none' || method === 'inhouse' ? method : 'shiprocket',
        quote?.name || '',
        quote?.id || '',
      ],
    )
    if (admin) await audit(c, admin, 'create', 'orders', order.id)
    return {
      orderId: order.id,
      response: {
        id: number,
        dbId: order.id,
        customer: cust,
        payment: body.payment,
        shippingMethod: method || 'shiprocket',
        courier: quote?.name || '',
        subtotal,
        discount,
        shipping,
        total,
        status: 'Confirmed',
        razorpay: checkout,
        items: saved.map(({ v, qty }) => ({
          product: { id: v.product_id, name: v.name, images: [v.image] },
          variant: { id: v.id, weight: v.weight, price: Number(v.price) },
          qty,
        })),
      },
    }
  })
  // Cash on Delivery ships now; online orders ship once the payment is verified
  if (body.payment === 'cod') syncShipmentInBackground(ctx, result.orderId)
  return result.response
}

// Cancels an unpaid online order whose payment window was closed and puts its stock back.
// Refuses while Razorpay reports a payment in progress or captured for that order.
export async function cancelUnpaidOrder({ pool, razorpay }, orderNumber, razorpayOrderId) {
  if (!razorpay.configured) throw httpError(503, 'Online payment is temporarily unavailable.')
  if (!razorpayOrderId) throw httpError(400, 'Payment order is required.')
  const payments = await razorpay.orderPayments(razorpayOrderId)
  if (!payments.ok) throw httpError(502, 'Unable to confirm the payment status with Razorpay.')
  if ((payments.data.items || []).some((p) => ['authorized', 'captured'].includes(p.status)))
    throw httpError(
      409,
      'A payment for this order is being processed. Please wait for confirmation.',
    )
  return withTransaction(pool, async (c) => {
    const order = (
      await c.query(
        "SELECT o.* FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.order_number=$1 AND p.provider_order_id=$2 AND o.payment='razorpay' FOR UPDATE OF o",
        [String(orderNumber || ''), String(razorpayOrderId)],
      )
    ).rows[0]
    if (!order) throw httpError(404, 'Order not found.')
    if (order.payment_status !== 'Unpaid' || order.status === 'Cancelled') return false
    await restoreStock(c, order.id)
    await c.query(
      "UPDATE orders SET status='Cancelled',notes=trim(coalesce(notes,'')||' Online payment was not completed; stock restored.') WHERE id=$1",
      [order.id],
    )
    await c.query(
      "UPDATE payments SET status='failed',updated_at=now() WHERE order_id=$1 AND status='created'",
      [order.id],
    )
    await c.query(
      "UPDATE shipments SET status='cancelled',updated_at=now() WHERE order_id=$1 AND status='pending'",
      [order.id],
    )
    return true
  })
}
