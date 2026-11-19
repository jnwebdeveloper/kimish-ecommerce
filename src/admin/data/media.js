import { apiRequest } from '../../data/StoreContext'
import {
  ALL_CONTENT_TYPES,
  IMAGE_CONTENT_TYPES,
  MEDIA_FOLDERS,
  fileProblem,
} from '../../utils/media'

export const acceptImages = IMAGE_CONTENT_TYPES.join(',')
export const acceptMedia = ALL_CONTENT_TYPES.join(',')
export const folderFor = (module) => MEDIA_FOLDERS[module]

// Sends the file straight to storage with a signed link, reporting progress (0–1)
function put(url, headers, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage refused the upload (status ${xhr.status}). Please try again.`))
    // CORS problems and dropped connections both end up here
    xhr.onerror = () =>
      reject(
        new Error(
          'The upload could not reach storage. Check your connection; if it keeps failing, check the bucket CORS rule (docs/media-storage-setup.md).',
        ),
      )
    xhr.send(file)
  })
}

// Uploads an image or video for a record and returns { url, mediaType, key }.
// recordId is the saved record's ID; leave it out for a record that hasn't been saved yet.
export async function uploadMedia(file, { folder, recordId, allowVideo = true, onProgress } = {}) {
  const problem = fileProblem(file, { allowVideo })
  if (problem) throw new Error(problem)
  const signed = await apiRequest('/api/admin/media/sign', {
    contentType: file.type,
    size: file.size,
    folder,
    ...(recordId ? { recordId: Number(recordId) } : {}),
  })
  await put(signed.uploadUrl, signed.headers, file, onProgress)
  return apiRequest('/api/admin/media/confirm', { key: signed.key })
}

// Deletes uploads that were never saved. The API keeps any file a record uses, so this is safe to
// call for every upload made in an editor when it closes.
export const discardMedia = (keys) =>
  keys.length ? apiRequest('/api/admin/media/discard', { keys }) : Promise.resolve()
