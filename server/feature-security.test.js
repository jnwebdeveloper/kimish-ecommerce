import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Compare against whitespace-free source so code formatting doesn't affect these checks
const compact = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\s+/g, '')
const api = compact('./api.js')
const admin = compact('../src/admin/Admin.jsx')
test('sensitive admin CRUD endpoints use authorization middleware', () => {
  for (const route of [
    "api.get('/api/admin/:module',guardSensitive",
    "api.post('/api/admin/:module',guardSensitive",
    "api.put('/api/admin/:module/:id',guardSensitive",
    "api.delete('/api/admin/:module/:id',guardSensitive",
  ])
    assert.ok(api.includes(route), route)
})
test('gallery batch persists image field rather than URL field', () => {
  assert.ok(admin.includes('product_id:editor.id,image:signed.publicUrl'))
  assert.ok(admin.includes('multipleaccept='))
})
