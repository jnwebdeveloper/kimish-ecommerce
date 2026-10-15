import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { loadEnv } from 'vite'
import { createApi } from './api.js'
import { readStorageConfig } from './integrations/storage/config.js'
import { createStorage } from './integrations/storage/index.js'
import { detectImageType } from './routes/adminUploads.js'

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

test('storage configuration: blocks, active storage, legacy R2 and startup errors', () => {
  // Nothing configured, or only blank lines: uploads disabled
  assert.deepEqual(readStorageConfig({}), { storages: [], active: null })
  assert.equal(readStorageConfig({ STORAGE_2_TYPE: '', STORAGE_2_BUCKET: ' ' }).active, null)

  // Vercel Blob falls back to BLOB_READ_WRITE_TOKEN
  let config = readStorageConfig({ STORAGE_1_TYPE: 'vercel-blob', BLOB_READ_WRITE_TOKEN: 'tok' })
  assert.deepEqual(
    [config.active.type, config.active.name, config.active.token],
    ['vercel-blob', 'Vercel Blob', 'tok'],
  )

  // Lowest number is active by default (numbers may have gaps); STORAGE_ACTIVE picks another
  config = readStorageConfig({ ...r2(3), ...r2(7, { STORAGE_7_NAME: 'Backup R2' }) })
  assert.equal(config.active.number, 3)
  assert.equal(config.active.endpoint, 'https://acc.r2.cloudflarestorage.com')
  assert.equal(config.active.publicUrl, 'https://images.example.com')
  config = readStorageConfig({
    ...r2(3),
    ...r2(7, { STORAGE_7_NAME: 'Backup R2' }),
    STORAGE_ACTIVE: '7',
  })
  assert.equal(config.active.name, 'Backup R2')

  // Every declared block must be complete and valid; errors name the variable, never its value
  throwsMentioning({ ...r2(1), STORAGE_1_SECRET: '' }, 'STORAGE_1_SECRET is missing')
  throwsMentioning({ ...r2(1), ...r2(2, { STORAGE_2_BUCKET: '' }) }, 'STORAGE_2_BUCKET is missing')
  throwsMentioning({ STORAGE_1_BUCKET: 'x' }, 'STORAGE_1_TYPE is missing')
  throwsMentioning({ STORAGE_1_TYPE: 'ftp' }, 'STORAGE_1_TYPE must be one of')
  throwsMentioning({ ...r2(1), STORAGE_ACTIVE: '2' }, 'storage 2 is not configured')
  throwsMentioning({ ...r2(1), STORAGE_ACTIVE: 'one' }, 'STORAGE_ACTIVE must be a storage number')
  throwsMentioning({ ...r2(1), STORAGE_1_PUBLIC_URL: 'http://images.example.com' }, 'https://')
  throwsMentioning({ STORAGE_1_TYPE: 'vercel-blob' }, 'BLOB_READ_WRITE_TOKEN')
  throwsMentioning(
    { STORAGE_1_TYPE: 'vercel-blob', STORAGE_2_TYPE: 'vercel-blob', BLOB_READ_WRITE_TOKEN: 't' },
    'only one vercel-blob storage',
  )
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

test('image type is detected from the file contents', () => {
  const pad = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)])
  assert.equal(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.equal(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
  assert.equal(detectImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'image/webp')
  assert.equal(detectImageType(Buffer.from('\0\0\0\x1cftypavif\0\0\0\0', 'latin1')), 'image/avif')
  assert.equal(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')), null)
  assert.equal(detectImageType(Buffer.from('GIF89a......')), null)
})

test('S3-compatible storage signs and PUTs the object, and returns its public URL', async () => {
  const received = []
  const fakeS3 = createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      received.push({
        method: req.method,
        url: req.url,
        type: req.headers['content-type'],
        signed: String(req.headers.authorization || '').startsWith('AWS4-HMAC-SHA256'),
        body: Buffer.concat(chunks),
      })
      res.writeHead(200, { ETag: '"abc"' }).end()
    })
  })
  await new Promise((r) => fakeS3.listen(0, '127.0.0.1', r))
  try {
    const silent = { info() {}, warn() {} }
    const storage = createStorage(
      {
        STORAGE_4_TYPE: 'custom',
        STORAGE_4_NAME: 'Local MinIO',
        STORAGE_4_ENDPOINT: `http://127.0.0.1:${fakeS3.address().port}`,
        STORAGE_4_REGION: 'us-east-1',
        STORAGE_4_BUCKET: 'shop-images',
        STORAGE_4_KEY_ID: 'minio',
        STORAGE_4_SECRET: 'minio-secret',
        STORAGE_4_PUBLIC_URL: 'http://localhost:9000/shop-images',
      },
      silent,
    )
    assert.deepEqual(storage.active, { number: 4, name: 'Local MinIO', type: 'custom' })
    const body = Buffer.from('fake image bytes')
    const url = await storage.upload({ key: 'products/a.png', body, contentType: 'image/png' })
    assert.equal(url, 'http://localhost:9000/shop-images/products/a.png')
    // custom storages use path-style addressing: /<bucket>/<key>
    assert.equal(received[0].method, 'PUT')
    assert.match(received[0].url, /^\/shop-images\/products\/a\.png/)
    assert.equal(received[0].type, 'image/png')
    assert.ok(received[0].signed)
    assert.ok(received[0].body.equals(body))
  } finally {
    await new Promise((r) => fakeS3.close(r))
  }
})

test('admin image upload endpoint: session, contents check, size limit and storage errors', async () => {
  const env = {
    ...loadEnv('development', process.cwd(), ''),
    ...process.env,
    AUTH_ORIGIN: 'http://localhost:5173',
    // The failures below are deliberate; keep their log lines out of the test output
    LOG_LEVEL: 'silent',
  }
  const stored = []
  const fakeStorage = {
    enabled: true,
    active: { number: 1, name: 'Test storage', type: 'r2' },
    fail: false,
    async upload(file) {
      if (this.fail) throw new Error('bucket unreachable: internal detail')
      stored.push(file)
      return `https://images.example.com/${file.key}`
    },
  }
  const { api, pool } = createApi({ ...env, VERCEL: '1' }, { storage: fakeStorage }),
    server = api.listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`
  let cookie = ''
  const upload = async (body, type = 'image/png') => {
    const r = await fetch(`${base}/api/admin/images`, {
      method: 'POST',
      headers: { Origin: env.AUTH_ORIGIN, 'Content-Type': type, Cookie: cookie },
      body,
    })
    return { status: r.status, data: await r.json() }
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(100),
  ])
  try {
    assert.equal((await upload(png)).status, 401)
    const login = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { Origin: env.AUTH_ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
    })
    assert.equal(login.status, 200)
    cookie = login.headers.get('set-cookie').split(';')[0]

    let r = await upload(png)
    assert.equal(r.status, 201)
    assert.match(r.data.url, /^https:\/\/images\.example\.com\/products\/[0-9a-f-]{36}\.png$/)
    assert.equal(stored[0].contentType, 'image/png')
    assert.ok(stored[0].body.equals(png))

    // The contents decide, not the declared type: text labelled as PNG, or an unsupported type, is refused
    assert.equal((await upload(Buffer.from('not an image at all'))).status, 400)
    assert.equal((await upload(png, 'image/gif')).status, 400)
    // On Vercel the limit is about 4.2 MB
    r = await upload(Buffer.concat([png, Buffer.alloc(Math.ceil(4.3 * 1024 * 1024))]))
    assert.deepEqual([r.status, r.data.message], [413, 'Images must be 4.2 MB or smaller.'])
    // Storage failures don't leak internal details
    fakeStorage.fail = true
    r = await upload(png)
    assert.equal(r.status, 502)
    assert.ok(!JSON.stringify(r.data).includes('internal detail'))
    // No storage configured: a clear message
    fakeStorage.enabled = false
    r = await upload(png)
    assert.equal(r.status, 503)
    assert.match(r.data.message, /not configured/)
    assert.equal(stored.length, 1)
  } finally {
    if (cookie)
      await fetch(`${base}/api/admin/logout`, {
        method: 'POST',
        headers: { Origin: env.AUTH_ORIGIN, Cookie: cookie },
      })
    await new Promise((r) => server.close(r))
    await pool.end()
  }
})
