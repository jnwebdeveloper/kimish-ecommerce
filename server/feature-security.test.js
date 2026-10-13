import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const api=readFileSync(new URL('./api.js',import.meta.url),'utf8')
const admin=readFileSync(new URL('../src/pages/Admin.jsx',import.meta.url),'utf8')
test('sensitive admin CRUD endpoints use authorization middleware',()=>{
 for(const route of ["api.get('/api/admin/:module',guardSensitive", "api.post('/api/admin/:module',guardSensitive", "api.put('/api/admin/:module/:id',guardSensitive", "api.delete('/api/admin/:module/:id',guardSensitive"]) assert.ok(api.includes(route),route)
})
test('gallery batch persists image field rather than URL field',()=>{
 assert.ok(admin.includes('product_id:editor.id,image:signed.publicUrl'))
 assert.ok(admin.includes('multiple accept='))
})
