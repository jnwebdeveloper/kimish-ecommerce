// Media rules shared by the admin screens and the API (the API enforces them).

// Values allowed in product_media.media_type
export const MEDIA_TYPES = Object.freeze({ IMAGE: 'image', VIDEO: 'video', OTHER: 'other' })
export const MEDIA_TYPE_VALUES = Object.freeze(Object.values(MEDIA_TYPES))

const MB = 1024 * 1024
// Largest upload for each kind of file. 'other' has no uploadable files yet.
export const MEDIA_LIMITS = Object.freeze({ image: 8 * MB, video: 50 * MB })

// Uploadable files: content type → file extension and media type
export const MEDIA_FILES = Object.freeze({
  'image/jpeg': { ext: 'jpg', mediaType: MEDIA_TYPES.IMAGE },
  'image/png': { ext: 'png', mediaType: MEDIA_TYPES.IMAGE },
  'image/webp': { ext: 'webp', mediaType: MEDIA_TYPES.IMAGE },
  'video/mp4': { ext: 'mp4', mediaType: MEDIA_TYPES.VIDEO },
  'video/webm': { ext: 'webm', mediaType: MEDIA_TYPES.VIDEO },
})
export const IMAGE_CONTENT_TYPES = Object.keys(MEDIA_FILES).filter(
  (type) => MEDIA_FILES[type].mediaType === MEDIA_TYPES.IMAGE,
)
export const ALL_CONTENT_TYPES = Object.keys(MEDIA_FILES)

// Storage folders, one per admin module that has an image field
export const MEDIA_FOLDERS = Object.freeze({
  products: 'products',
  categories: 'categories',
  banners: 'banners',
  content_sections: 'content',
  gift_boxes: 'gift-boxes',
  seo_pages: 'seo',
})
export const MEDIA_FOLDER_NAMES = Object.freeze([...new Set(Object.values(MEDIA_FOLDERS))])

const VIDEO_EXTENSIONS = Object.values(MEDIA_FILES)
  .filter((f) => f.mediaType === MEDIA_TYPES.VIDEO)
  .map((f) => f.ext)
// Media type of a stored URL, judged by its file extension (anything that isn't a video is shown as an image)
export function mediaTypeOfUrl(url = '') {
  const path = String(url).split(/[?#]/)[0].toLowerCase()
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith('.' + ext))
    ? MEDIA_TYPES.VIDEO
    : MEDIA_TYPES.IMAGE
}

export const formatBytes = (bytes) => `${Math.round(bytes / MB)} MB`

// Quick check in the browser before uploading; returns an error message, or '' when the file is fine
export function fileProblem(file, { allowVideo = true } = {}) {
  const rule = MEDIA_FILES[file?.type]
  if (!rule || (!allowVideo && rule.mediaType !== MEDIA_TYPES.IMAGE))
    return allowVideo
      ? `${file?.name || 'This file'}: choose a JPG, PNG or WebP image, or an MP4 or WebM video.`
      : `${file?.name || 'This file'}: choose a JPG, PNG or WebP image.`
  const limit = MEDIA_LIMITS[rule.mediaType]
  if (file.size < 1 || file.size > limit)
    return `${file.name}: ${rule.mediaType === MEDIA_TYPES.VIDEO ? 'videos' : 'images'} must be ${formatBytes(limit)} or smaller.`
  return ''
}
