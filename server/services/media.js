import { randomUUID } from 'node:crypto'
import { httpError } from '../lib/http.js'
import {
  MEDIA_FILES,
  MEDIA_FOLDER_NAMES,
  MEDIA_LIMITS,
  MEDIA_TYPE_VALUES,
  MEDIA_TYPES,
  formatBytes,
  mediaTypeOfUrl,
} from '../../src/utils/media.js'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const EXTENSIONS = [...new Set(Object.values(MEDIA_FILES).map((f) => f.ext))]
const kindOfExtension = Object.fromEntries(
  Object.values(MEDIA_FILES).map((f) => [f.ext, f.mediaType]),
)
// Every key the API hands out: <folder>/<recordId>-<uuid>.<ext> or <folder>/new-<uuid>.<ext>
export const MEDIA_KEY = new RegExp(
  `^(${MEDIA_FOLDER_NAMES.join('|')})/(\\d+-|new-)(${UUID})\\.(${EXTENSIONS.join('|')})$`,
)

const positiveId = (value) =>
  (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647) ||
  (typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647)

// Checks a sign request and returns { key, contentType, size, mediaType }
export function uploadRequest({ contentType, size, folder, recordId } = {}) {
  const rule = MEDIA_FILES[contentType]
  if (!rule) throw httpError(400, 'Upload a JPG, PNG or WebP image, or an MP4 or WebM video.')
  const limit = MEDIA_LIMITS[rule.mediaType]
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1)
    throw httpError(400, 'File size is missing or invalid.')
  if (size > limit)
    throw httpError(
      400,
      `${rule.mediaType === MEDIA_TYPES.VIDEO ? 'Videos' : 'Images'} must be ${formatBytes(limit)} or smaller.`,
    )
  if (!MEDIA_FOLDER_NAMES.includes(folder)) throw httpError(400, 'Unknown upload folder.')
  const saved = recordId !== undefined && recordId !== null && recordId !== ''
  if (saved && !positiveId(recordId)) throw httpError(400, 'Record ID must be a positive number.')
  const key = `${folder}/${saved ? Number(recordId) : 'new'}-${randomUUID()}.${rule.ext}`
  return { key, contentType, size, mediaType: rule.mediaType }
}

// The kind of file its first bytes show: 'image', 'video' or null
const IMAGE_BRANDS = ['avif', 'avis', 'heic', 'heix', 'heim', 'heis', 'mif1', 'msf1']
export function detectMediaKind(bytes) {
  const b = Buffer.from(bytes || [])
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return MEDIA_TYPES.IMAGE
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return MEDIA_TYPES.IMAGE
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP')
    return MEDIA_TYPES.IMAGE
  if (b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return MEDIA_TYPES.VIDEO
  if (b.toString('latin1', 4, 8) === 'ftyp' && !IMAGE_BRANDS.includes(b.toString('latin1', 8, 12)))
    return MEDIA_TYPES.VIDEO
  return null
}

// After the browser's upload: checks the stored file and deletes it when it isn't acceptable
export async function confirmUpload(storage, key, log) {
  const match = typeof key === 'string' ? MEDIA_KEY.exec(key) : null
  if (!match) throw httpError(400, 'Invalid upload key.')
  const kind = kindOfExtension[match[4]]
  const head = await storage.readStart(key)
  if (!head) throw httpError(400, "The upload didn't reach storage. Please try again.")
  const discard = async (message) => {
    await storage
      .remove(key)
      .catch((err) => log?.warn('Could not delete rejected upload', { key, err }))
    throw httpError(400, message)
  }
  if (detectMediaKind(head.bytes) !== kind)
    await discard(
      kind === MEDIA_TYPES.VIDEO
        ? "That file isn't an MP4 or WebM video. Please choose another file."
        : "That file isn't a JPG, PNG or WebP image. Please choose another file.",
    )
  if (head.size > MEDIA_LIMITS[kind])
    await discard(
      `${kind === MEDIA_TYPES.VIDEO ? 'Videos' : 'Images'} must be ${formatBytes(MEDIA_LIMITS[kind])} or smaller.`,
    )
  return { url: storage.urlFor(key), mediaType: kind }
}

const validUrl = (url) => /^(\/(?!\/)|https?:\/\/)/i.test(url) && url.length <= 2000

// Checks a product's gallery from the editor: [{ media_url, alt_text, media_type }]
export function galleryInput(images) {
  if (images === undefined) return undefined
  if (!Array.isArray(images) || images.length > 50)
    throw httpError(400, 'A product can have up to 50 gallery items.')
  return images.map((item) => {
    const url = String(item?.media_url ?? '').trim()
    if (!validUrl(url))
      throw httpError(400, 'Each gallery item needs a relative path or http(s) URL.')
    const type = item.media_type || mediaTypeOfUrl(url)
    if (!MEDIA_TYPE_VALUES.includes(type)) throw httpError(400, 'Invalid gallery media type.')
    const alt = String(item.alt_text ?? '').trim()
    if (alt.length > 500)
      throw httpError(400, 'Gallery descriptions must be 500 characters or fewer.')
    return { media_url: url, alt_text: alt, media_type: type }
  })
}

// Uploads made before a record had an ID are named <folder>/new-<uuid>.<ext>. Once the record is
// saved they are copied to <folder>/<id>-<uuid>.<ext>. Returns a map of old URL → new URL.
// tracker collects the copies and the originals, so the caller can delete one set or the other.
export async function claimNewUploads(storage, folder, id, urls, tracker) {
  const renamed = new Map()
  if (!storage?.enabled) return renamed
  for (const url of new Set(urls)) {
    const key = storage.keyFromUrl(url)
    const match = key && MEDIA_KEY.exec(key)
    if (!match || match[1] !== folder || match[2] !== 'new-') continue
    const newKey = `${folder}/${id}-${match[3]}.${match[4]}`
    try {
      await storage.copy(key, newKey)
    } catch {
      throw httpError(400, 'An uploaded file could not be found in storage. Upload it again.')
    }
    tracker.copied.push(newKey)
    tracker.originals.push(key)
    renamed.set(url, storage.urlFor(newKey))
  }
  return renamed
}

// Deletes storage objects, ignoring failures (an orphaned file is harmless)
export async function removeQuietly(storage, keys, log) {
  for (const key of keys)
    await storage.remove(key).catch((err) => log?.warn('Could not delete media file', { key, err }))
}
