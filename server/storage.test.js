import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { loadEnv } from 'vite'
import { createApi } from './api.js'
import { readStorageConfig } from './integrations/storage/config.js'
import { createStorage } from './integrations/storage/index.js'
import { MEDIA_KEY, detectMediaKind } from './services/media.js'

const MB = 1024 * 1024
const silent = { info() {}, warn() {}, error() {} }
const r2 = (n, extra = {}) => ({
  [`STORAGE_${n}_TYPE`]: 'r2',
  [`STORAGE_${n}_ACCOUNT_ID`]: 'acc',
  [`STORAGE_${n}_BUCKET`]: 'images',
  [`STORAGE_${n}_KEY_ID`]: 'key-id',
  [`STORAGE_${n}_SECRET`]: 'super-secret-value',
  [`STORAGE_${n}_PUBLIC_URL`]: 'https://images.example.com/',
  ...extra,
})
const throwsMentioning = (env, text) =>
  assert.throws(
    () => readStorageConfig(env),
    (e) => e.message.includes(text) && !e.message.includes('super-secret-value'),
  )

// Sample file starts
const pad = (bytes, size = 64) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(size)])
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0])
const WEBP = pad([...Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')])
const MP4 = pad([...Buffer.from('\0\0\0\x18ftypisom\0\0\0\0', 'latin1')])
const WEBM = pad([0x1a, 0x45, 0xdf, 0xa3])
const TEXT = Buffer.from('just some text pretending to be a photo, nothing more to see')

test('storage configuration: blocks, active storage, legacy R2 and startup errors', () => {
  // Nothing configured, or only blank lines: uploads disabled
  assert.deepEqual(readStorageConfig({}), { storages: [], active: null })
  assert.equal(readStorageConfig({ STORAGE_2_TYPE: '', STORAGE_2_BUCKET: ' ' }).active, null)

  // A leftover Vercel Blob block is accepted (the API still starts) but can't take direct uploads
  let config = readStorageConfig({ STORAGE_1_TYPE: 'vercel-blob' })
  assert.deepEqual([config.active.type, config.active.direct], ['vercel-blob', false])
  assert.equal(createStorage({ STORAGE_1_TYPE: 'vercel-blob' }, silent).enabled, false)

  // Lowest number is active by default (numbers may have gaps); STORAGE_ACTIVE picks another
  config = readStorageConfig({ ...r2(3), ...r2(7, { STORAGE_7_NAME: 'Backup R2' }) })
  assert.equal(config.active.number, 3)
  assert.equal(config.active.direct, true)
  assert.equal(config.active.endpoint, 'https://acc.r2.cloudflarestorage.com')
  assert.equal(config.active.region, 'auto')
  assert.equal(config.active.publicUrl, 'https://images.example.com')
  config = readStorageConfig({
    ...r2(3),
    ...r2(7, { STORAGE_7_NAME: 'Backup R2' }),
    STORAGE_ACTIVE: '7',
  })
  assert.equal(config.active.name, 'Backup R2')

  // Files are found in whichever configured storage their URL belongs to, active or not
  const both = createStorage(
    {
      ...r2(1, { STORAGE_1_PUBLIC_URL: 'https://old.example.com' }),
      ...r2(2, { STORAGE_2_PUBLIC_URL: 'https://new.example.com' }),
      STORAGE_ACTIVE: '2',
    },
    silent,
  )
  assert.equal(both.number, 2)
  assert.deepEqual(both.locate('https://old.example.com/products/a.png'), {
    number: 1,
    key: 'products/a.png',
  })
  assert.deepEqual(both.locate('https://new.example.com/banners/b.webp'), {
    number: 2,
    key: 'banners/b.webp',
  })
  assert.equal(both.locate('https://elsewhere.example.com/products/a.png'), null)
  assert.equal(both.locate('/products/kimish-cashew.png'), null)

  // Every declared block must be complete and valid; errors name the variable, never its value
  throwsMentioning({ ...r2(1), STORAGE_1_SECRET: '' }, 'STORAGE_1_SECRET is missing')
  throwsMentioning({ ...r2(1), STORAGE_1_ACCOUNT_ID: '' }, 'STORAGE_1_ACCOUNT_ID is missing')
  throwsMentioning({ ...r2(1), STORAGE_1_PUBLIC_URL: '' }, 'STORAGE_1_PUBLIC_URL is missing')
  throwsMentioning({ ...r2(1), ...r2(2, { STORAGE_2_BUCKET: '' }) }, 'STORAGE_2_BUCKET is missing')
  throwsMentioning({ STORAGE_1_BUCKET: 'x' }, 'STORAGE_1_TYPE is missing')
  throwsMentioning({ STORAGE_1_TYPE: 'ftp' }, 'STORAGE_1_TYPE must be one of')
  throwsMentioning({ ...r2(1), STORAGE_ACTIVE: '2' }, 'storage 2 is not configured')
  throwsMentioning({ ...r2(1), STORAGE_ACTIVE: 'one' }, 'STORAGE_ACTIVE must be a storage number')
  throwsMentioning({ ...r2(1), STORAGE_1_PUBLIC_URL: 'http://images.example.com' }, 'https://')
  throwsMentioning(
    {
      STORAGE_1_TYPE: 's3',
      STORAGE_1_BUCKET: 'b',
      STORAGE_1_KEY_ID: 'k',
      STORAGE_1_SECRET: 's',
      STORAGE_1_PUBLIC_URL: 'https://x.example',
    },
    'STORAGE_1_REGION is missing',
  )
  throwsMentioning(
    { ...r2(1), STORAGE_1_TYPE: 'custom', STORAGE_1_REGION: 'us-east-1' },
    'STORAGE_1_ENDPOINT is missing',
  )

  // Legacy single-bucket R2_* variables become storage 1 (R2_BUCKET_NAME or the older R2_BUCKET)
  const legacy = {
    R2_ACCOUNT_ID: 'acc',
    R2_ACCESS_KEY_ID: 'k',
    R2_SECRET_ACCESS_KEY: 's',
    R2_PUBLIC_URL: 'https://pub-1.r2.dev',
  }
  for (const bucket of [{ R2_BUCKET_NAME: 'b1' }, { R2_BUCKET: 'b1' }]) {
    config = readStorageConfig({ ...legacy, ...bucket })
    assert.deepEqual(
      [config.active.number, config.active.type, config.active.bucket],
      [1, 'r2', 'b1'],
    )
  }
  // STORAGE_<n>_* blocks take precedence over the legacy variables
  assert.equal(readStorageConfig({ ...legacy, R2_BUCKET: 'b1', ...r2(2) }).active.number, 2)
  // A partial legacy set disables uploads with a warning instead of stopping the API
  const warnings = []
  config = readStorageConfig({ R2_ACCOUNT_ID: 'acc' }, (msg, fields) =>
    warnings.push(fields.missing),
  )
  assert.equal(config.active, null)
  assert.ok(warnings[0].includes('R2_SECRET_ACCESS_KEY'))
})

test('file kind is detected from the first bytes, not the name', () => {
  for (const image of [PNG, JPEG, WEBP]) assert.equal(detectMediaKind(image), 'image')
  for (const video of [MP4, WEBM]) assert.equal(detectMediaKind(video), 'video')
  // A renamed text file, SVG, GIF and AVIF (an image in an MP4-style container) are refused
  assert.equal(detectMediaKind(TEXT), null)
  assert.equal(detectMediaKind(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')), null)
  assert.equal(detectMediaKind(Buffer.from('GIF89a......')), null)
  assert.equal(detectMediaKind(pad([...Buffer.from('\0\0\0\x1cftypavif', 'latin1')])), null)
  assert.equal(detectMediaKind(Buffer.alloc(4)), null)
})

test('S3-compatible storage: signed PUT link, ranged read, copy and delete', async () => {
  const received = []
  const fakeS3 = createServer((req, res) => {
    received.push({ method: req.method, url: req.url, headers: req.headers })
    if (req.url.includes('missing')) {
      res.writeHead(404, { 'Content-Type': 'application/xml' })
      return res.end('<Error><Code>NoSuchKey</Code><Message>gone</Message></Error>')
    }
    if (req.method === 'GET') {
      res.writeHead(206, { 'Content-Range': `bytes 0-31/${5 * MB}`, 'Content-Length': 32 })
      return res.end(PNG.subarray(0, 32))
    }
    if (req.method === 'PUT') {
      res.writeHead(200, { 'Content-Type': 'application/xml' })
      return res.end(
        '<CopyObjectResult><ETag>"abc"</ETag><LastModified>2026-01-01T00:00:00.000Z</LastModified></CopyObjectResult>',
      )
    }
    res.writeHead(204).end()
  })
  await new Promise((r) => fakeS3.listen(0, '127.0.0.1', r))
  try {
    const storage = createStorage(
      {
        STORAGE_4_TYPE: 'custom',
        STORAGE_4_NAME: 'Local MinIO',
        STORAGE_4_ENDPOINT: `http://127.0.0.1:${fakeS3.address().port}`,
        STORAGE_4_REGION: 'us-east-1',
        STORAGE_4_BUCKET: 'shop-media',
        STORAGE_4_KEY_ID: 'minio',
        STORAGE_4_SECRET: 'minio-secret',
        STORAGE_4_PUBLIC_URL: 'http://localhost:9000/shop-media',
      },
      silent,
    )
    assert.equal(storage.enabled, true)
    assert.deepEqual(storage.active, { number: 4, name: 'Local MinIO', type: 'custom' })
    assert.equal(
      storage.urlFor('products/a.png'),
      'http://localhost:9000/shop-media/products/a.png',
    )
    assert.equal(
      storage.keyFromUrl('http://localhost:9000/shop-media/products/a.png'),
      'products/a.png',
    )
    assert.equal(storage.keyFromUrl('https://elsewhere.example/products/a.png'), null)

    // The link is valid for 10 minutes and only for this content type and size
    const link = new URL(
      await storage.signUpload({ key: 'products/new-x.png', contentType: 'image/png', size: 1234 }),
    )
    assert.match(link.pathname, /^\/shop-media\/products\/new-x\.png$/)
    assert.equal(link.searchParams.get('X-Amz-Expires'), '600')
    assert.equal(link.searchParams.get('X-Amz-SignedHeaders'), 'content-length;content-type;host')
    assert.ok(![...link.searchParams.keys()].some((k) => k.toLowerCase().includes('checksum')))
    assert.ok(!link.href.includes('minio-secret'))

    const head = await storage.readStart('products/new-x.png')
    assert.equal(head.size, 5 * MB)
    assert.ok(head.bytes.equals(PNG.subarray(0, 32)))
    assert.equal(received.at(-1).headers.range, 'bytes=0-31')
    assert.equal(await storage.readStart('products/missing.png'), null)

    await storage.copy('products/new-x.png', 'products/7-x.png')
    assert.equal(received.at(-1).method, 'PUT')
    assert.match(received.at(-1).url, /^\/shop-media\/products\/7-x\.png/)
    assert.equal(received.at(-1).headers['x-amz-copy-source'], 'shop-media/products/new-x.png')

    await storage.remove('products/new-x.png')
    assert.equal(received.at(-1).method, 'DELETE')
  } finally {
    await new Promise((r) => fakeS3.close(r))
  }
})

// In-memory storage with the same methods as the real one
function memoryStorage() {
  const base = 'https://media.example.com/'
  const objects = new Map()
  return {
    objects,
    removed: [],
    enabled: true,
    active: { number: 1, name: 'Test storage', type: 'r2' },
    number: 1,
    urlFor: (key) => base + key,
    keyFromUrl: (url) => (url?.startsWith(base) ? url.slice(base.length) : null),
    locate(url) {
      const key = this.keyFromUrl(url)
      return key ? { number: 1, key } : null
    },
    async removeFrom(number, key) {
      if (number !== 1) return false
      await this.remove(key)
      return true
    },
    async signUpload({ key }) {
      return 'https://upload.example.com/' + key + '?signed'
    },
    async readStart(key) {
      const body = objects.get(key)
      return body ? { bytes: body.subarray(0, 32), size: body.length } : null
    },
    async copy(from, to) {
      if (!objects.has(from)) throw new Error('NoSuchKey')
      objects.set(to, objects.get(from))
    },
    async remove(key) {
      objects.delete(key)
      this.removed.push(key)
    },
  }
}

const env = {
  ...loadEnv('development', process.cwd(), ''),
  ...process.env,
  AUTH_ORIGIN: 'http://localhost:5173',
  // The failures below are deliberate; keep their log lines out of the test output
  LOG_LEVEL: 'silent',
}

async function startApi(storage) {
  const { api, pool } = createApi(env, { storage })
  const server = api.listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`
  let cookie = ''
  const call = async (path, body, method) => {
    const r = await fetch(base + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { Origin: env.AUTH_ORIGIN, 'Content-Type': 'application/json', Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: r.status, data: await r.json() }
  }
  return {
    pool,
    call,
    async login() {
      const r = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: { Origin: env.AUTH_ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
      })
      assert.equal(r.status, 200)
      cookie = r.headers.get('set-cookie').split(';')[0]
    },
    async stop() {
      if (cookie) await call('/api/admin/logout', {})
      await new Promise((r) => server.close(r))
      await pool.end()
    },
  }
}

test('media sign and confirm endpoints', async () => {
  const storage = memoryStorage()
  const app = await startApi(storage)
  const sign = (body) => app.call('/api/admin/media/sign', body)
  const confirm = (key) => app.call('/api/admin/media/confirm', { key })
  const good = { contentType: 'image/png', size: 1000, folder: 'products' }
  try {
    // Admins only
    assert.equal((await sign(good)).status, 401)
    assert.equal((await confirm('products/new-x.png')).status, 401)
    await app.login()

    // Unknown types, bad sizes, folders and record IDs are refused
    for (const bad of [
      { contentType: 'image/gif' },
      { contentType: 'image/svg+xml' },
      { contentType: 'application/pdf' },
      { size: 0 },
      { size: -5 },
      { size: 12.5 },
      { size: '1000' },
      { size: 8 * MB + 1 },
      { contentType: 'video/mp4', size: 50 * MB + 1 },
      { folder: 'secrets' },
      { folder: '../products' },
      { recordId: 0 },
      { recordId: -3 },
      { recordId: 1.5 },
      { recordId: 'abc' },
      { recordId: '12/../../x' },
    ]) {
      const r = await sign({ ...good, ...bad })
      assert.equal(r.status, 400, JSON.stringify(bad))
    }

    // A record that isn't saved yet gets a new-… key; a saved one gets its ID in the key
    let r = await sign(good)
    assert.equal(r.status, 201)
    assert.match(r.data.key, /^products\/new-[0-9a-f-]{36}\.png$/)
    assert.equal(r.data.url, 'https://media.example.com/' + r.data.key)
    assert.deepEqual(r.data.headers, { 'Content-Type': 'image/png' })
    assert.equal(r.data.mediaType, 'image')
    assert.match(r.data.uploadUrl, /^https:\/\/upload\.example\.com\//)
    r = await sign({ ...good, contentType: 'video/webm', size: 50 * MB, recordId: 42 })
    assert.equal(r.status, 201)
    assert.match(r.data.key, /^products\/42-[0-9a-f-]{36}\.webm$/)
    assert.equal(r.data.mediaType, 'video')
    assert.match(
      (await sign({ ...good, folder: 'gift-boxes', recordId: '7' })).data.key,
      /^gift-boxes\/7-/,
    )

    // Confirm: only keys the API could have issued
    for (const key of [
      'products/x.png',
      '../products/new-00000000-0000-0000-0000-000000000000.png',
      'secrets/new-00000000-0000-0000-0000-000000000000.png',
      'products/new-00000000-0000-0000-0000-000000000000.gif',
      undefined,
    ])
      assert.equal((await confirm(key)).status, 400, String(key))

    const key = (ext, prefix = 'new-') => `products/${prefix}${crypto.randomUUID()}.${ext}`
    // Nothing arrived in storage
    r = await confirm(key('png'))
    assert.deepEqual(
      [r.status, r.data.message],
      [400, "The upload didn't reach storage. Please try again."],
    )

    // A text file renamed to .jpg is refused and deleted
    let k = key('jpg')
    storage.objects.set(k, TEXT)
    r = await confirm(k)
    assert.equal(r.status, 400)
    assert.ok(!storage.objects.has(k))

    // A PNG saved as .jpg is still an image; a real video is accepted as a video
    k = key('jpg')
    storage.objects.set(k, PNG)
    r = await confirm(k)
    assert.deepEqual(r.data, { url: 'https://media.example.com/' + k, mediaType: 'image', key: k })
    k = key('mp4', '9-')
    storage.objects.set(k, MP4)
    assert.equal((await confirm(k)).data.mediaType, 'video')
    // An image disguised as a video, or a video disguised as an image, is refused
    k = key('mp4')
    storage.objects.set(k, PNG)
    assert.equal((await confirm(k)).status, 400)
    k = key('webp')
    storage.objects.set(k, WEBM)
    assert.equal((await confirm(k)).status, 400)

    // Discard: deletes uploads nothing uses; only API-issued keys are accepted
    for (const keys of [['../etc/passwd'], ['products/x.png'], 'products/a.png', [42]])
      assert.equal((await app.call('/api/admin/media/discard', { keys })).status, 400)
    k = key('webp')
    storage.objects.set(k, WEBP)
    r = await app.call('/api/admin/media/discard', { keys: [k] })
    assert.deepEqual([r.status, r.data.deleted], [200, [k]])
    assert.ok(!storage.objects.has(k))

    // Too big for its kind: refused and deleted
    k = key('png')
    storage.objects.set(k, Buffer.concat([PNG, Buffer.alloc(8 * MB)]))
    r = await confirm(k)
    assert.equal(r.status, 400)
    assert.ok(!storage.objects.has(k))

    // Without a usable storage the endpoints say so
    storage.enabled = false
    r = await sign(good)
    assert.equal(r.status, 503)
    assert.match(r.data.message, /not configured/)
  } finally {
    await app.stop()
  }
})

test('saving a new product renames new-… uploads and saves the gallery in order', async () => {
  const storage = memoryStorage()
  const app = await startApi(storage)
  const created = []
  try {
    await app.login()
    const groupId = (await app.pool.query("SELECT id FROM category_groups WHERE name='Nuts'"))
      .rows[0].id
    let r = await app.call('/api/admin/categories', {
      name: 'QA Media Category',
      slug: 'qa-media-category',
      group_id: groupId,
      active: true,
    })
    assert.equal(r.status, 200, JSON.stringify(r))
    created.push(['categories', r.data.id])
    const categoryId = r.data.id

    // Uploaded before the product had an ID
    const put = (ext, body) => {
      const key = `products/new-${crypto.randomUUID()}.${ext}`
      storage.objects.set(key, body)
      return { key, url: storage.urlFor(key) }
    }
    const main = put('png', PNG)
    const video = put('mp4', MP4)
    const photo = put('webp', WEBP)
    const product = {
      name: 'QA Media Product',
      slug: 'qa-media-product',
      category_id: categoryId,
      media_url: main.url,
      active: true,
      images: [
        { media_url: video.url, media_type: 'video', alt_text: 'Demo video' },
        { media_url: main.url, media_type: 'image', alt_text: 'Front of pack' },
        { media_url: photo.url, media_type: 'image', alt_text: '' },
        { media_url: photo.url, media_type: 'image', alt_text: 'repeat' },
        { media_url: '/products/kimish-cashew.png', alt_text: 'Existing file' },
      ],
    }

    // A video can't be the main image
    r = await app.call('/api/admin/products', { ...product, media_url: video.url })
    assert.equal(r.status, 400)
    assert.match(r.data.message, /must be an image/)
    // Media without any photo can't be saved: the first item must be a photo
    r = await app.call('/api/admin/products', {
      ...product,
      media_url: '',
      images: [{ media_url: video.url, media_type: 'video', alt_text: '' }],
    })
    assert.equal(r.status, 400)
    assert.match(r.data.message, /must be a photo/)
    assert.equal(storage.removed.length, 0)

    r = await app.call('/api/admin/products', product)
    assert.equal(r.status, 200, JSON.stringify(r))
    const id = r.data.id
    created.push(['products', id])

    const saved = (await app.pool.query('SELECT media_url FROM products WHERE id=$1', [id])).rows[0]
    assert.match(saved.media_url, new RegExp(`/products/${id}-[0-9a-f-]{36}\\.png$`))
    const gallery = (
      await app.pool.query(
        'SELECT media_url,media_type,alt_text,sort_order FROM product_media WHERE product_id=$1 ORDER BY sort_order,id',
        [id],
      )
    ).rows
    assert.deepEqual(
      gallery.map((g) => [g.media_type, g.alt_text, g.sort_order]),
      [
        ['image', 'Front of pack', 0],
        ['video', 'Demo video', 1],
        ['image', '', 2],
        ['image', 'Existing file', 3],
      ],
    )
    assert.equal(gallery[0].media_url, saved.media_url)
    for (const g of gallery.slice(0, 3)) {
      assert.ok(!g.media_url.includes('/new-'), g.media_url)
      assert.ok(MEDIA_KEY.test(storage.keyFromUrl(g.media_url)))
      assert.ok(storage.objects.has(storage.keyFromUrl(g.media_url)))
    }
    assert.equal(gallery[3].media_url, '/products/kimish-cashew.png')
    // Each row records where its file is stored; external files have no storage
    const places = (
      await app.pool.query(
        'SELECT storage_number,storage_key FROM product_media WHERE product_id=$1 ORDER BY sort_order,id',
        [id],
      )
    ).rows
    assert.deepEqual(
      places.map((p) => p.storage_number),
      [1, 1, 1, null],
    )
    assert.deepEqual(
      places.map((p) => p.storage_key),
      [...gallery.slice(0, 3).map((g) => storage.keyFromUrl(g.media_url)), null],
    )
    // The new-… originals are deleted after the save
    assert.deepEqual(storage.removed.sort(), [main.key, video.key, photo.key].sort())

    // The admin list returns each product with its gallery
    const listed = (await app.call('/api/admin/products')).data.find((p) => p.id === id)
    assert.deepEqual(
      listed.images.map((g) => g.media_url),
      gallery.map((g) => g.media_url),
    )

    // Discard never deletes a saved file
    r = await app.call('/api/admin/media/discard', { keys: [storage.keyFromUrl(saved.media_url)] })
    assert.deepEqual(r.data.deleted, [])

    // Editing the product: removed files are deleted from storage after the save, unless another
    // record uses them; external files are only removed from the list
    const photoUrl = gallery[2].media_url
    const videoUrl = gallery[1].media_url
    await app.pool.query('UPDATE categories SET image=$1 WHERE id=$2', [photoUrl, categoryId])
    storage.removed.length = 0
    r = await app.call(
      `/api/admin/products/${id}`,
      { ...product, media_url: saved.media_url, images: [listed.images[1]] },
      'PUT',
    )
    assert.equal(r.status, 200, JSON.stringify(r))
    const after = (
      await app.pool.query(
        'SELECT media_type FROM product_media WHERE product_id=$1 ORDER BY sort_order,id',
        [id],
      )
    ).rows
    assert.deepEqual(
      after.map((g) => g.media_type),
      ['image', 'video'],
    )
    // The photo is still the category's image, so it stays
    assert.equal(storage.removed.length, 0)
    assert.ok(storage.objects.has(storage.keyFromUrl(photoUrl)))

    // Removing the video deletes its file
    r = await app.call(
      `/api/admin/products/${id}`,
      { ...product, media_url: saved.media_url, images: [] },
      'PUT',
    )
    assert.equal(r.status, 200, JSON.stringify(r))
    assert.deepEqual(storage.removed, [storage.keyFromUrl(videoUrl)])

    // A missing upload stops the save and leaves nothing behind
    const lost = `https://media.example.com/products/new-${crypto.randomUUID()}.png`
    r = await app.call(
      `/api/admin/products/${id}`,
      { ...product, media_url: lost, images: [] },
      'PUT',
    )
    assert.equal(r.status, 400)
    assert.equal(
      (await app.pool.query('SELECT media_url FROM products WHERE id=$1', [id])).rows[0].media_url,
      saved.media_url,
    )

    // Deleting the product deletes its files
    storage.removed.length = 0
    r = await app.call(`/api/admin/products/${id}`, null, 'DELETE')
    assert.equal(r.status, 200)
    created.pop()
    assert.deepEqual(storage.removed, [storage.keyFromUrl(saved.media_url)])
  } finally {
    for (const [module, id] of created.reverse())
      await app.call(`/api/admin/${module}/${id}`, null, 'DELETE')
    await app.stop()
  }
})
