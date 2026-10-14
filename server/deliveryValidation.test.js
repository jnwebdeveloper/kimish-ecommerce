import test from 'node:test'
import assert from 'node:assert/strict'
import { validateDelivery } from '../src/data/deliveryValidation.js'
const valid = {
  name: 'Jane Doe',
  mobile: '9876543210',
  email: 'jane@example.com',
  pincode: '302001',
  address: '123 Example Road',
  city: 'Jaipur',
  state: 'Rajasthan',
}
test('accepts complete valid delivery details', () => assert.deepEqual(validateDelivery(valid), {}))
test('rejects invalid mobile, email and pincode', () => {
  const e = validateDelivery({ ...valid, mobile: '123', email: 'invalid', pincode: '12' })
  assert.ok(e.mobile && e.email && e.pincode)
})
test('rejects missing address and name', () => {
  const e = validateDelivery({ ...valid, name: '', address: '' })
  assert.ok(e.name && e.address)
})
test('allows optional blank email', () =>
  assert.deepEqual(validateDelivery({ ...valid, email: '' }), {}))
