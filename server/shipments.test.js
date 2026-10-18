import test from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import { createPool } from './db.js'
import { shiprocketOrderPayload, syncShipment } from './services/shipments.js'

const order = {
  order_number: 'KIM1760000000000ABCD',
  created_at: '2026-10-17T20:45:00Z', // 2:15 AM on 18 Oct in India
  payment: 'cod',
  subtotal: '189.00',
  shipping: '40.00',
  discount: '18.90',
  total: '210.10',
  customer_snapshot: {
    name: 'Test Customer',
    mobile: '9000000000',
    email: '',
    pincode: '495001',
    address: 'Flat 25',
    landmark: '',
    city: 'Bilaspur',
    state: 'Chhattisgarh',
  },
}
const items = [
  { product_name: 'Cashew 100g', variant_id: 7, quantity: 1, price: '189.00', weight_kg: '0.2', length_cm: '15', breadth_cm: '10', height_cm: '5' },
]

test('Shiprocket order amounts add up to the order total collected on COD', () => {
  const p = shiprocketOrderPayload(order, items, { shiprocket_pickup_location: 'warehouse' })
  assert.equal(p.sub_total, 189)
  assert.equal(p.shipping_charges, 40)
  assert.equal(p.total_discount, 18.9)
  assert.equal(p.sub_total + p.shipping_charges - p.total_discount, Number(order.total))
  assert.equal(p.payment_method, 'COD')
  assert.equal(p.pickup_location, 'warehouse')
})

test('Shiprocket order date is in Indian time and email falls back to the store email', () => {
  const p = shiprocketOrderPayload(order, items, { support_email: 'help@kimish.in' })
  assert.equal(p.order_date, '2026-10-18 02:15')
  assert.equal(p.billing_email, 'help@kimish.in')
  assert.equal(shiprocketOrderPayload(order, items).billing_email, '')
})

test('Shiprocket package uses the variant dimensions and a 0.5 kg minimum weight', () => {
  const p = shiprocketOrderPayload(order, items)
  assert.deepEqual([p.length, p.breadth, p.height, p.weight], [15, 10, 5, 0.5])
})

test('Simultaneous verify + webhook create exactly one Shiprocket order', async () => {
  const pool = createPool({ ...loadEnv('development', process.cwd(), ''), ...process.env })
  const number = `KIMT${Date.now()}`.slice(0, 20)
  const ids = []
  const addOrder = async (suffix, payment, paymentStatus) => {
    const o = (
      await pool.query(
        "INSERT INTO orders(order_number,payment,payment_status,subtotal,total,customer_snapshot) VALUES($1,$2,$3,100,100,$4) RETURNING id",
        [number + suffix, payment, paymentStatus, JSON.stringify(order.customer_snapshot)],
      )
    ).rows[0]
    await pool.query("INSERT INTO shipments(order_id,provider,status) VALUES($1,'shiprocket','pending')", [o.id])
    ids.push(o.id)
    return o.id
  }
  const status = async (id) =>
    (await pool.query('SELECT status,provider_order_id FROM shipments WHERE order_id=$1', [id])).rows[0]
  try {
    let calls = 0
    const slowShiprocket = {
      createOrder: async () => {
        calls++
        await new Promise((r) => setTimeout(r, 150))
        return { order_id: 111, shipment_id: 222 }
      },
    }
    const paid = await addOrder('P', 'razorpay', 'Paid')
    const ctx = { pool, env: {}, shiprocket: slowShiprocket }
    await Promise.all([syncShipment(ctx, paid), syncShipment(ctx, paid)])
    assert.equal(calls, 1)
    assert.deepEqual(await status(paid), { status: 'created', provider_order_id: '111' })

    // A later failing attempt must not mark the created shipment as failed
    await syncShipment({ pool, env: {}, shiprocket: { createOrder: async () => { throw new Error('boom') } } }, paid)
    assert.equal((await status(paid)).status, 'created')

    // Unpaid online orders are never sent; a failed COD order can be retried
    const unpaid = await addOrder('U', 'razorpay', 'Unpaid')
    await syncShipment(ctx, unpaid)
    assert.equal((await status(unpaid)).status, 'pending')
    const cod = await addOrder('C', 'cod', 'Unpaid')
    await assert.rejects(syncShipment({ pool, env: {}, shiprocket: { createOrder: async () => { throw new Error('down') } } }, cod))
    assert.equal((await status(cod)).status, 'failed')
    await syncShipment(ctx, cod)
    assert.equal((await status(cod)).status, 'created')
  } finally {
    if (ids.length) await pool.query('DELETE FROM orders WHERE id=ANY($1)', [ids])
    await pool.end()
  }
})
