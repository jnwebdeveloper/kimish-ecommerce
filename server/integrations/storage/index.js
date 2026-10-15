import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { put } from '@vercel/blob'
import { readStorageConfig } from './config.js'

// Uploaded files never change (each gets a new random name), so browsers and CDNs may cache them for a year
const cacheSeconds = 31536000

// R2, Amazon S3 and other S3-compatible services: write the object, serve it from PUBLIC_URL
function s3Uploader(storage) {
  const client = new S3Client({
    region: storage.region,
    endpoint: storage.endpoint,
    // MinIO and several S3-compatible services expect bucket names in the path
    forcePathStyle: storage.type === 'custom',
    credentials: { accessKeyId: storage.keyId, secretAccessKey: storage.secret },
  })
  return async ({ key, body, contentType }) => {
    await client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: `public, max-age=${cacheSeconds}, immutable`,
      }),
    )
    return `${storage.publicUrl}/${key}`
  }
}

// Vercel Blob returns the public URL of the stored file
function vercelBlobUploader(storage) {
  return async ({ key, body, contentType }) =>
    (
      await put(key, body, {
        access: 'public',
        token: storage.token,
        contentType,
        addRandomSuffix: false,
        cacheControlMaxAge: cacheSeconds,
      })
    ).url
}

// Reads the storage configuration (throwing if it is invalid) and returns the uploader for the
// active storage. Images uploaded to other storages keep their full URLs and keep loading from there.
export function createStorage(env, log) {
  const { storages, active } = readStorageConfig(env, log.warn)
  if (!active) log.info('Image uploads are disabled: no storage is configured')
  else
    log.info('Image storage ready', {
      active: `${active.number}: ${active.name}`,
      storages: storages.map((s) => `${s.number}: ${s.name} (${s.type})`),
    })
  const upload = active
    ? active.type === 'vercel-blob'
      ? vercelBlobUploader(active)
      : s3Uploader(active)
    : null
  return {
    enabled: Boolean(active),
    active: active && { number: active.number, name: active.name, type: active.type },
    // upload({ key, body: Buffer, contentType }) → public URL
    upload,
  }
}
