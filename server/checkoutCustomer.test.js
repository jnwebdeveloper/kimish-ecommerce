import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { checkoutCustomer } from './services/checkoutCustomer.js'

test('signed-in checkout resolves buyer from verified cookie, ignoring recipient and submitted ownership', async () => {
  const pool = {
    async query(sql, params) {
      assert.match(sql, /s.expires_at>now\(\)/)
      assert.equal(params[0], createHash('sha256').update('session-token').digest('hex'))
      return { rows: [{ id: 7 }] }
    },
  }
  const buyer = await checkoutCustomer(pool, {
    headers: { cookie: 'other=value; kimish_session=session-token' },
    body: { customer_id: 99, customer: { mobile: '9000000002' } },
  })
  assert.deepEqual(buyer, { id: 7 })
})
test('missing or expired checkout sessions cannot silently create an order for another account', async () => {
  const pool = {
    async query() {
      return { rows: [] }
    },
  }
  for (const cookie of ['', 'kimish_session=expired']) {
    await assert.rejects(
      checkoutCustomer(pool, { headers: { cookie } }),
      (error) => error.status === 401,
    )
  }
})
