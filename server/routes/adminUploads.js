import express from 'express'
import { randomUUID } from 'node:crypto'
import { httpError } from '../lib/http.js'

const MB = 1024 * 1024
const extensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

// Identifies the image from its first bytes, so a renamed or mislabelled file can't be stored as an image
export function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png'
  if (buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP')
    return 'image/webp'
  if (
    buffer.toString('latin1', 4, 8) === 'ftyp' &&
    ['avif', 'avis'].includes(buffer.toString('latin1', 8, 12))
  )
    return 'image/avif'
  return null
}

// Admin image uploads go through the API into the active storage. Mounted at /api/admin after requireAdmin.
export function adminUploadRoutes({ env, storage }) {
  const router = express.Router()
  // Vercel functions reject request bodies over 4.5 MB, so stay safely below that there
  const maxBytes = env.VERCEL ? Math.floor(4.2 * MB) : 8 * MB
  const maxLabel = env.VERCEL ? '4.2 MB' : '8 MB'
  const rawImage = express.raw({ type: Object.keys(extensions), limit: maxBytes })
  const receive = (req, res, next) =>
    rawImage(req, res, (err) =>
      next(
        err?.type === 'entity.too.large'
          ? httpError(413, `Images must be ${maxLabel} or smaller.`)
          : err,
      ),
    )

  // Body: the image file itself, with its Content-Type. Answers { url } to save on the record.
  router.post('/images', receive, async (req, res) => {
    if (!storage.enabled)
      throw httpError(
        503,
        'Image uploads are not configured. Set the STORAGE_1_* variables (see .env.example), or paste an image link instead.',
      )
    const type = detectImageType(req.body)
    if (!type) throw httpError(400, `Upload a JPG, PNG, WebP or AVIF image up to ${maxLabel}.`)
    const key = `products/${randomUUID()}.${extensions[type]}`
    let url
    try {
      url = await storage.upload({ key, body: req.body, contentType: type })
    } catch (err) {
      req.log.error('Image upload to storage failed', { storage: storage.active.name, key, err })
      throw httpError(502, 'The image could not be stored. Please try again.')
    }
    req.log.info('Image uploaded', { storage: storage.active.name, key, bytes: req.body.length })
    res.status(201).json({ url })
  })

  return router
}
