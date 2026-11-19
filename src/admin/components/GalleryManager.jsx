import { useState } from 'react'
import { MEDIA_TYPES, mediaTypeOfUrl } from '../../utils/media'
import { acceptMedia, folderFor, uploadMedia } from '../data/media'

const isImage = (item) => item?.media_type === MEDIA_TYPES.IMAGE

// The first item is the main image, so it must be a photo. If a change would leave something else
// first (e.g. removing the main photo when a video follows it), the next photo moves to the front.
function withPhotoFirst(items) {
  const main = items.findIndex(isImage)
  return main > 0 ? [items[main], ...items.slice(0, main), ...items.slice(main + 1)] : items
}

// The product's photos and videos in one list, reordered with the arrows. The first item is the main
// image (products.media_url) and must be a photo. Files upload straight away; "Save changes" saves the list.
// record/set/busy/setBusy/setError/setNotice belong to the editor dialog.
export default function GalleryManager({
  record,
  set,
  uploads,
  busy,
  setBusy,
  setError,
  setNotice,
}) {
  const [progress, setProgress] = useState('')
  const [link, setLink] = useState('')
  // Products saved before the gallery held the main image: show it at the front
  const saved = record.images || []
  const items = withPhotoFirst(
    record.media_url && !saved.some((i) => i.media_url === record.media_url)
      ? [{ media_url: record.media_url, media_type: MEDIA_TYPES.IMAGE, alt_text: '' }, ...saved]
      : saved,
  )
  const hasMain = isImage(items[0])

  const update = (next) => {
    const ordered = withPhotoFirst(next)
    set('images', ordered)
    set('media_url', isImage(ordered[0]) ? ordered[0].media_url : '')
  }
  const edit = (index, changes) =>
    update(items.map((item, i) => (i === index ? { ...item, ...changes } : item)))
  const move = (index, step) => {
    const next = [...items]
    ;[next[index], next[index + step]] = [next[index + step], next[index]]
    update(next)
  }
  // A move is allowed when it keeps a photo in the first position
  const canMove = (index, step) => {
    const to = index + step
    if (to < 0 || to >= items.length) return false
    if (to === 0) return isImage(items[index])
    if (index === 0) return isImage(items[1])
    return true
  }
  const firstPhotoOnly =
    "A video can't be first: the first item is the main image and must be a photo."
  // A file uploaded in this session and not saved yet is deleted from storage right away. Saved
  // files are only taken off the list; the API deletes them from storage when you save.
  const remove = (index) => {
    const item = items[index]
    if (uploads.isNew(item.upload_key)) uploads.discard(item.upload_key)
    update(items.filter((_, i) => i !== index))
  }
  const add = (added) => {
    const known = new Set(items.map((i) => i.media_url))
    update([...items, ...added.filter((i) => !known.has(i.media_url))])
  }

  async function upload(files) {
    if (!files.length) return
    setBusy(true)
    setError('')
    const added = []
    try {
      for (const [n, file] of files.entries()) {
        const { url, mediaType, key } = await uploadMedia(file, {
          folder: folderFor('products'),
          recordId: record.id,
          onProgress: (share) =>
            setProgress(
              `Uploading ${n + 1} of ${files.length}: ${file.name} (${Math.round(share * 100)}%)`,
            ),
        }).catch((e) => {
          throw new Error(
            e.message.startsWith(file.name) ? e.message : `${file.name}: ${e.message}`,
          )
        })
        uploads.track(key)
        added.push({ media_url: url, media_type: mediaType, alt_text: '', upload_key: key })
      }
    } catch (e) {
      setError(
        (added.length ? `${added.length} file(s) uploaded before this one failed. ` : '') +
          e.message,
      )
    } finally {
      if (added.length) {
        add(added)
        setNotice(`${added.length} file(s) added. Click Save changes to keep them.`)
      }
      setProgress('')
      setBusy(false)
    }
  }

  function addLink() {
    const url = link.trim()
    if (!/^(\/(?!\/)|https?:\/\/)/i.test(url)) {
      setError('Enter a link starting with https:// or /.')
      return
    }
    setError('')
    add([{ media_url: url, media_type: mediaTypeOfUrl(url), alt_text: '' }])
    setLink('')
  }

  return (
    <fieldset className="admin-form-section admin-media-section">
      <legend>Photos & videos</legend>
      <p className="admin-media-help">
        Use the arrows to set the order. The first item is the main image, shown on product cards,
        in the cart and in search results, so it must be a photo. The product page shows everything
        in this order. Changes are kept when you click Save changes, and removed files are deleted
        from storage then.
      </p>
      {!!items.length && !hasMain && (
        <p className="error" role="alert">
          Add a photo: the first item must be a photo, so this product cannot be saved with videos
          only.
        </p>
      )}
      {items.length ? (
        <div className="admin-gallery-grid">
          {items.map((item, i) => {
            const main = i === 0 && hasMain
            return (
              <div key={item.media_url} className={main ? 'is-main' : ''}>
                <div className="admin-media-preview">
                  {item.media_type === MEDIA_TYPES.VIDEO ? (
                    <video src={item.media_url} controls preload="metadata" />
                  ) : item.media_type === MEDIA_TYPES.OTHER ? (
                    <a href={item.media_url} target="_blank" rel="noreferrer">
                      Open file
                    </a>
                  ) : (
                    <img src={item.media_url} alt={item.alt_text || 'Product photo'} />
                  )}
                  <span className={`admin-badge${main ? ' is-positive' : ''}`}>
                    {main
                      ? 'Main image'
                      : item.media_type === MEDIA_TYPES.VIDEO
                        ? 'Video'
                        : item.media_type === MEDIA_TYPES.OTHER
                          ? 'File'
                          : 'Photo'}
                  </span>
                </div>
                <label>
                  Description
                  <input
                    value={item.alt_text || ''}
                    maxLength={500}
                    onChange={(e) => edit(i, { alt_text: e.target.value })}
                  />
                </label>
                <div className="admin-gallery-actions">
                  <button
                    type="button"
                    aria-label="Move earlier"
                    title={i === 1 && !isImage(item) ? firstPhotoOnly : 'Move earlier'}
                    disabled={busy || !canMove(i, -1)}
                    onClick={() => move(i, -1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label="Move later"
                    title={
                      i === 0 && !canMove(i, 1) && i < items.length - 1
                        ? firstPhotoOnly
                        : 'Move later'
                    }
                    disabled={busy || !canMove(i, 1)}
                    onClick={() => move(i, 1)}
                  >
                    →
                  </button>
                  <button type="button" disabled={busy} onClick={() => remove(i)}>
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="admin-media-empty">
          No photos or videos yet. The first photo you add becomes the main image.
        </p>
      )}
      <div className="admin-media-add">
        <label>
          Upload photos or videos
          <input
            type="file"
            multiple
            disabled={busy}
            accept={acceptMedia}
            onChange={(e) => {
              upload([...e.target.files])
              e.target.value = ''
            }}
          />
          <small>JPG, PNG or WebP images up to 8 MB; MP4 or WebM videos up to 50 MB.</small>
        </label>
        <label>
          Or add by link
          <span className="admin-media-link">
            <input
              type="text"
              placeholder="https://… or /products/photo.png"
              value={link}
              disabled={busy}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addLink()
                }
              }}
            />
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy || !link.trim()}
              onClick={addLink}
            >
              Add
            </button>
          </span>
          <small>Paste a photo or video address, then click Add.</small>
        </label>
      </div>
      {progress && <p role="status">{progress}</p>}
    </fieldset>
  )
}
