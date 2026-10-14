import { randomUUID } from 'node:crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
export async function presignImage(env, { type, size }) {
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET ||
    !env.R2_PUBLIC_URL
  )
    throw Object.assign(new Error('Cloudflare R2 is not configured.'), { status: 503 })
  if (
    !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(type) ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 8 * 1024 * 1024
  )
    throw Object.assign(new Error('Upload a JPG, PNG, WebP or AVIF image up to 8 MB.'), {
      status: 400,
    })
  const key = `products/${randomUUID()}.${{ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }[type]}`
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  })
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: type }),
    { expiresIn: 300 },
  )
  return { uploadUrl, publicUrl: `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`, key }
}
