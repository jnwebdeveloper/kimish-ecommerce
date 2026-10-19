import test from 'node:test'
import assert from 'node:assert/strict'
import { validate } from './modules.js'
import { trackCommerce } from '../src/data/pixel.js'
test('SEO accepts local page paths and rejects external, query and fragment paths', () => {
  const body = { path: '/shop', title: 'Our shop', active: true }
  assert.equal(validate('seo_pages', body, true).path, '/shop')
  for (const path of ['https://example.com', '//example.com', '/shop?q=1', '/shop#heading'])
    assert.throws(() => validate('seo_pages', { ...body, path }, true))
})
test('Meta Pixel settings accept an ID or blank to disable and reject scripts', () => {
  for (const value of ['', '123456789012345'])
    assert.equal(validate('settings', { key: 'meta_pixel_id', value }, false).value, value)
  assert.throws(() =>
    validate('settings', { key: 'meta_pixel_id', value: '<script>bad()</script>' }, false),
  )
})
test('commerce tracking honors disabled pixel and targets only the configured pixel', () => {
  const calls = []
  globalThis.window = { fbq: (...args) => calls.push(args), kimishPixelId: '' }
  try {
    assert.equal(trackCommerce('AddToCart'), false)
    window.kimishPixelId = '1234567890'
    assert.equal(trackCommerce('AddToCart', { value: 50 }), true)
    assert.deepEqual(calls, [['trackSingle', '1234567890', 'AddToCart', { value: 50 }]])
    assert.equal(trackCommerce('Unknown'), false)
  } finally {
    delete globalThis.window
  }
})
