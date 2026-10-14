import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const orders = source('./services/orders.js')
const adminAuth = source('./routes/adminAuth.js')
const sql = source('./migrations/20261011_security.sql')
test('checkout locks variants before decrement', () => {
  assert.match(orders, /FOR UPDATE OF v/)
  assert.match(orders, /stock=stock-\$1 WHERE id=\$2 AND stock >= \$1/)
})
test('recovery tokens are hashed and single-use', () => {
  assert.match(adminAuth, /hash\(token\)/)
  assert.match(adminAuth, /used_at IS NULL/)
  assert.match(adminAuth, /DELETE FROM admin_sessions/)
})
test('inventory has nonnegative database constraint', () =>
  assert.match(sql, /CHECK \(stock >= 0\)/))
