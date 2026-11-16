import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Compare against whitespace-free source so code formatting doesn't affect these checks
const compact = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\s+/g, '')
const app = compact('./api.js')
const records = compact('./routes/adminRecords.js')
const gallery = compact('../src/admin/components/GalleryManager.jsx')
test('admin routes require a session and sensitive modules use the primary-admin guard', () => {
  // requireAdmin is mounted before every admin router except sign-in/recovery
  assert.ok(
    app.indexOf("api.use('/api/admin',requireAdmin(pool))") <
      app.indexOf("api.use('/api/admin',adminAccountRoutes(ctx)"),
  )
  assert.ok(records.includes('constguard=guardSensitive(env)'))
  for (const route of [
    "router.get('/:module',guard",
    "router.post('/:module',guard",
    "router.put('/:module/:id',guard",
    "router.delete('/:module/:id',guard",
  ])
    assert.ok(records.includes(route), route)
})
test('gallery keeps uploaded media on the product and accepts several photos and videos', () => {
  assert.ok(gallery.includes('media_url:url,media_type:mediaType'))
  assert.ok(gallery.includes("set('images',ordered)"))
  assert.ok(gallery.includes("set('media_url',isImage(ordered[0])?ordered[0].media_url:'')"))
  assert.ok(gallery.includes('multiple'))
  assert.ok(gallery.includes('accept={acceptMedia}'))
})
