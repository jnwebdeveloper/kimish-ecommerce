import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { readStorageConfig } from './config.js'

const missing = (err) =>
  err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404

// R2, Amazon S3 and other S3-compatible services. The browser uploads straight to the bucket with a
// short-lived signed link; the API only signs, checks, copies and deletes. One client is reused.
function s3Storage(storage) {
  const client = new S3Client({
    region: storage.region,
    endpoint: storage.endpoint,
    // MinIO and several S3-compatible services expect bucket names in the path
    forcePathStyle: storage.type === 'custom',
    credentials: { accessKeyId: storage.keyId, secretAccessKey: storage.secret },
    // R2 rejects presigned PUTs that carry the SDK's default checksum parameters
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  const prefix = storage.publicUrl + '/'
  return {
    urlFor: (key) => prefix + key,
    // The object key of a URL in this storage, or null for any other URL
    keyFromUrl: (url) =>
      typeof url === 'string' && url.startsWith(prefix) ? url.slice(prefix.length) : null,

    // A PUT link that only accepts this exact content type and size
    signUpload: ({ key, contentType, size, expiresIn = 600 }) =>
      getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: storage.bucket,
          Key: key,
          ContentType: contentType,
          ContentLength: size,
        }),
        { expiresIn, signableHeaders: new Set(['content-type', 'content-length']) },
      ),

    // First bytes of an object and its total size, or null when it doesn't exist
    async readStart(key, length = 32) {
      try {
        const res = await client.send(
          new GetObjectCommand({
            Bucket: storage.bucket,
            Key: key,
            Range: `bytes=0-${length - 1}`,
          }),
        )
        const bytes = Buffer.from(await res.Body.transformToByteArray())
        const total = /\/(\d+)$/.exec(res.ContentRange || '')?.[1]
        return { bytes, size: total ? Number(total) : Number(res.ContentLength ?? bytes.length) }
      } catch (err) {
        if (missing(err)) return null
        throw err
      }
    },

    copy: (fromKey, toKey) =>
      client.send(
        new CopyObjectCommand({
          Bucket: storage.bucket,
          CopySource: `${storage.bucket}/${fromKey}`,
          Key: toKey,
        }),
      ),

    remove: (key) => client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key })),
  }
}

// Reads the storage configuration (throwing if it is invalid) and returns the active storage.
// Files uploaded to other storages keep their full URLs and keep loading from there.
export function createStorage(env, log) {
  const { storages, active } = readStorageConfig(env, log.warn)
  const usable = active?.direct ? active : null
  if (!active) log.info('Media uploads are disabled: no storage is configured')
  else if (!usable)
    log.warn(
      'Media uploads are disabled: Vercel Blob cannot take direct uploads. Make an R2 or S3 storage active (see docs/media-storage-setup.md).',
      { active: `${active.number}: ${active.name}` },
    )
  else
    log.info('Media storage ready', {
      active: `${active.number}: ${active.name}`,
      storages: storages.map((s) => `${s.number}: ${s.name} (${s.type})`),
    })
  return {
    enabled: Boolean(usable),
    active: active && { number: active.number, name: active.name, type: active.type },
    ...(usable ? s3Storage(usable) : { keyFromUrl: () => null }),
  }
}
