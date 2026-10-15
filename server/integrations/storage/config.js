// Reads the STORAGE_<n>_* blocks (see .env.example) into storage definitions and checks them.
// Any problem in a declared block throws, so a misconfigured API refuses to start instead of
// failing on the first upload. Error messages name variables, never their values.

const required = {
  'vercel-blob': [],
  r2: ['ACCOUNT_ID', 'BUCKET', 'KEY_ID', 'SECRET', 'PUBLIC_URL'],
  s3: ['REGION', 'BUCKET', 'KEY_ID', 'SECRET', 'PUBLIC_URL'],
  custom: ['ENDPOINT', 'REGION', 'BUCKET', 'KEY_ID', 'SECRET', 'PUBLIC_URL'],
}
const defaultNames = {
  'vercel-blob': 'Vercel Blob',
  r2: 'Cloudflare R2',
  s3: 'Amazon S3',
  custom: 'S3-compatible storage',
}
const legacyR2 = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL']

const value = (env, name) => String(env[name] ?? '').trim()
const fail = (message) => {
  throw new Error(`Image storage configuration: ${message} See .env.example.`)
}

// Image URLs must be served over HTTPS (http is accepted only for a local MinIO etc.)
function checkUrl(label, url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    fail(`${label} is not a valid URL.`)
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:'))
    fail(`${label} must start with https://.`)
}

function storageBlock(env, n) {
  const v = (field) => value(env, `STORAGE_${n}_${field}`)
  const type = v('TYPE')
  if (!type) fail(`STORAGE_${n}_TYPE is missing.`)
  if (!required[type])
    fail(`STORAGE_${n}_TYPE must be one of ${Object.keys(required).join(', ')} (got "${type}").`)
  const name = v('NAME') || defaultNames[type]
  for (const field of required[type])
    if (!v(field)) fail(`storage ${n} (${name}): STORAGE_${n}_${field} is missing.`)
  if (type === 'vercel-blob') {
    const token = v('TOKEN') || value(env, 'BLOB_READ_WRITE_TOKEN')
    if (!token)
      fail(
        `storage ${n} (${name}): set STORAGE_${n}_TOKEN or BLOB_READ_WRITE_TOKEN (added by Vercel when a Blob store is connected).`,
      )
    return { number: n, type, name, token, sharedToken: !v('TOKEN') }
  }
  checkUrl(`STORAGE_${n}_PUBLIC_URL`, v('PUBLIC_URL'))
  if (type === 'custom') checkUrl(`STORAGE_${n}_ENDPOINT`, v('ENDPOINT'))
  return {
    number: n,
    type,
    name,
    bucket: v('BUCKET'),
    keyId: v('KEY_ID'),
    secret: v('SECRET'),
    publicUrl: v('PUBLIC_URL').replace(/\/+$/, ''),
    region: type === 'r2' ? 'auto' : v('REGION'),
    endpoint:
      type === 'r2'
        ? `https://${v('ACCOUNT_ID')}.r2.cloudflarestorage.com`
        : type === 'custom'
          ? v('ENDPOINT')
          : undefined,
  }
}

// The single-bucket R2_* variables used before STORAGE_<n>_* existed, as storage 1.
// A partial set only disables uploads (with a warning) rather than stopping the API.
function legacyBlock(env, warn) {
  const bucket = value(env, 'R2_BUCKET_NAME') || value(env, 'R2_BUCKET')
  const present = legacyR2.filter((name) => value(env, name))
  if (!present.length && !bucket) return []
  if (present.length < legacyR2.length || !bucket) {
    const missing = [
      ...legacyR2.filter((name) => !value(env, name)),
      ...(bucket ? [] : ['R2_BUCKET_NAME']),
    ]
    warn('Legacy R2_* variables are incomplete; image uploads are disabled', { missing })
    return []
  }
  return [
    storageBlock(
      {
        STORAGE_1_TYPE: 'r2',
        STORAGE_1_NAME: 'Cloudflare R2',
        STORAGE_1_ACCOUNT_ID: env.R2_ACCOUNT_ID,
        STORAGE_1_BUCKET: bucket,
        STORAGE_1_KEY_ID: env.R2_ACCESS_KEY_ID,
        STORAGE_1_SECRET: env.R2_SECRET_ACCESS_KEY,
        STORAGE_1_PUBLIC_URL: env.R2_PUBLIC_URL,
      },
      1,
    ),
  ]
}

// Returns { storages: [...by number], active: storage | null }
export function readStorageConfig(env, warn = () => {}) {
  // A block is declared when any of its variables has a value; blank lines don't count
  const numbers = [
    ...new Set(
      Object.keys(env)
        .map((key) => /^STORAGE_(\d+)_[A-Z_]+$/.exec(key))
        .filter((match) => match && value(env, match[0]))
        .map((match) => Number(match[1])),
    ),
  ].sort((a, b) => a - b)
  const storages = numbers.length
    ? numbers.map((n) => storageBlock(env, n))
    : legacyBlock(env, warn)

  if (storages.filter((s) => s.type === 'vercel-blob' && s.sharedToken).length > 1)
    fail(
      'only one vercel-blob storage can use BLOB_READ_WRITE_TOKEN; give the others their own STORAGE_<n>_TOKEN.',
    )

  const activeSetting = value(env, 'STORAGE_ACTIVE')
  if (!activeSetting) return { storages, active: storages[0] || null }
  if (!/^\d+$/.test(activeSetting))
    fail(`STORAGE_ACTIVE must be a storage number (got "${activeSetting}").`)
  const active = storages.find((s) => s.number === Number(activeSetting))
  if (!active)
    fail(
      `STORAGE_ACTIVE=${activeSetting} but storage ${activeSetting} is not configured${storages.length ? ` (configured: ${storages.map((s) => s.number).join(', ')})` : ''}.`,
    )
  return { storages, active }
}
