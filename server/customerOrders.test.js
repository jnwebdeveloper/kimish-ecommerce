import test from 'node:test'
import assert from 'node:assert/strict'
import { customerOrders } from './services/customerOrders.js'
function database(session = { customer_id: 7 }) {
  const orders = [
    {
      id: 1,
      customer_id: 7,
      order_number: 'OWN',
      total: '200',
      customer_snapshot: { name: 'Customer' },
    },
    { id: 2, customer_id: 8, order_number: 'OTHER', total: '500' },
  ]
  const calls = []
  return {
    calls,
    async query(sql, args) {
      calls.push({ sql, args })
      if (sql.includes('FROM customer_sessions'))
        return { rows: args[0] === 'valid' && session ? [session] : [] }
      if (sql.includes('FROM orders'))
        return {
          rows: orders.filter(
            (o) => o.customer_id === args[0] && (!args[1] || o.order_number === args[1]),
          ),
        }
      if (sql.includes('FROM order_items'))
        return { rows: [{ id: 10, product_name: 'Makhana', price: '100', quantity: 2 }] }
      throw new Error('Unexpected query')
    },
  }
}
test('order history requires a valid unexpired session', async () => {
  const db = database()
  const result = await customerOrders(db, 'invalid')
  assert.equal(result.status, 401)
  assert.equal(db.calls.length, 1)
  assert.match(db.calls[0].sql, /expires_at>now\(\)/)
})
test('list is restricted to the session customer and sorted newest first', async () => {
  const db = database()
  const result = await customerOrders(db, 'valid')
  assert.deepEqual(
    result.body.orders.map((o) => o.order_number),
    ['OWN'],
  )
  assert.match(db.calls[1].sql, /ORDER BY created_at DESC,id DESC/)
})
test('detail includes saved items and does not expose internal order id', async () => {
  const result = await customerOrders(database(), 'valid', 'OWN')
  assert.equal(result.status, 200)
  assert.equal(result.body.items[0].product_name, 'Makhana')
  assert.equal(result.body.customer_snapshot.name, 'Customer')
  assert.equal(result.body.id, undefined)
})
test('another customer order and unknown order both return 404 without reading items', async () => {
  for (const number of ['OTHER', 'MISSING', "' OR 1=1 --"]) {
    const db = database()
    const result = await customerOrders(db, 'valid', number)
    assert.equal(result.status, 404)
    assert.equal(db.calls.length, 2)
  }
})
test('customer with no orders receives an empty list', async () => {
  const result = await customerOrders(database({ customer_id: 9 }), 'valid')
  assert.deepEqual(result.body, { orders: [] })
})
