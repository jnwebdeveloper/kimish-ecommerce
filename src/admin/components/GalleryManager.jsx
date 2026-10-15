import { useState } from 'react'
import { apiRequest } from '../../data/StoreContext'
import { acceptImages, isAllowedImage, uploadImage } from '../data/uploads'

// Product gallery inside the product editor: edit captions/order, remove photos, upload several at once.
// busy/setBusy/setError/setNotice belong to the editor dialog; reload refreshes the page's lists.
export default function GalleryManager({
  productId,
  images = [],
  busy,
  setBusy,
  setError,
  setNotice,
  reload,
}) {
  const [files, setFiles] = useState([]),
    [progress, setProgress] = useState(''),
    // Unsaved caption/order edits, keyed by image id
    [drafts, setDrafts] = useState({})
  const photos = images
    .filter((i) => i.product_id === productId)
    .map((i) => ({ ...i, ...drafts[i.id] }))
    .sort((a, b) => a.sort_order - b.sort_order)
  const edit = (id, changes) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }))

  async function run(action) {
    setBusy(true)
    try {
      await action()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function uploadAll() {
    if (!productId) {
      setError('Save the product before uploading its gallery.')
      return
    }
    if (!files.length) {
      setError('Select at least one image.')
      return
    }
    setBusy(true)
    setError('')
    const nextOrder = Math.max(-1, ...photos.map((i) => Number(i.sort_order))) + 1
    let done = 0
    try {
      for (const file of files) {
        if (!isAllowedImage(file))
          throw new Error(`${file.name}: choose a JPG, PNG, WebP or AVIF file under 8 MB.`)
        setProgress(`Uploading ${done + 1} of ${files.length}: ${file.name}`)
        const url = await uploadImage(file).catch((e) => {
          throw new Error(`${file.name}: ${e.message}`)
        })
        await apiRequest(
          '/api/admin/product_images',
          { product_id: productId, image: url, alt: file.name, sort_order: nextOrder + done },
          'POST',
        )
        done++
      }
      setFiles([])
      setProgress('')
      setNotice(`${done} gallery image(s) saved.`)
      await reload()
    } catch (e) {
      setError(`${done} image(s) saved. ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-gallery-upload">
      <h3>Product gallery</h3>
      <p>Additional photos shown alongside the primary product image.</p>
      <div className="admin-gallery-grid">
        {photos.map((photo) => (
          <div key={photo.id}>
            <img src={photo.image} alt={photo.alt || 'Product photo'} />
            <label>
              Image description
              <input
                value={photo.alt || ''}
                onChange={(e) => edit(photo.id, { alt: e.target.value })}
              />
            </label>
            <label>
              Display order
              <input
                type="number"
                min="0"
                value={photo.sort_order}
                onChange={(e) => edit(photo.id, { sort_order: Number(e.target.value) })}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await apiRequest('/api/admin/product_images/' + photo.id, photo, 'PUT')
                  setNotice('Gallery photo updated.')
                  await reload()
                })
              }
            >
              Save photo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await apiRequest('/api/admin/product_images/' + photo.id, null, 'DELETE')
                  await reload()
                })
              }
            >
              Remove photo
            </button>
          </div>
        ))}
      </div>
      <input
        aria-label="Choose multiple gallery images"
        type="file"
        multiple
        accept={acceptImages}
        onChange={(e) => setFiles([...e.target.files])}
      />
      <p>{files.length} image(s) selected. Save the product first, then upload the gallery.</p>
      {progress && <p role="status">{progress}</p>}
      <button
        type="button"
        className="btn btn-outline"
        disabled={busy || !productId || !files.length}
        onClick={uploadAll}
      >
        Upload all gallery images
      </button>
    </div>
  )
}
