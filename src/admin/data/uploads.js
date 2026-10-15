const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const acceptImages = imageTypes.join(',')
// Quick check before sending; the server enforces its own limit (about 4.2 MB on Vercel) and checks the file contents
export const isAllowedImage = (file) =>
  imageTypes.includes(file.type) && file.size <= 8 * 1024 * 1024

// Sends the image to the API, which stores it in the active storage; returns its public URL
export async function uploadImage(file) {
  const response = await fetch('/api/admin/images', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    credentials: 'same-origin',
    body: file,
  })
  let data = {}
  try {
    data = await response.json()
  } catch {
    // Non-JSON reply (e.g. a proxy error page); fall back to a generic message
  }
  if (!response.ok)
    throw Object.assign(new Error(data.message || 'Image upload failed. Please try again.'), {
      status: response.status,
    })
  return data.url
}
