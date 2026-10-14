import { apiRequest } from '../../data/StoreContext'

const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const acceptImages = imageTypes.join(',')
export const isAllowedImage = (file) =>
  imageTypes.includes(file.type) && file.size <= 8 * 1024 * 1024

// Uploads an image straight to Cloudflare R2 with a URL signed by the API; returns its public URL
export async function uploadImage(file, failureMessage) {
  const signed = await apiRequest('/api/admin/images/presign', {
    filename: file.name,
    type: file.type,
    size: file.size,
  })
  const uploaded = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!uploaded.ok) throw new Error(failureMessage)
  return signed.publicUrl
}
