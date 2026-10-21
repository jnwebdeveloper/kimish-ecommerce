const key = 'kimish-public-catalog-v1'
const arrays = [
  'products',
  'categories',
  'coupons',
  'banners',
  'pages',
  'navigation',
  'content_sections',
  'gift_boxes',
  'seo_pages',
  'reviews',
]
export const emptyCatalog = Object.fromEntries([
  ...arrays.map((name) => [name, []]),
  ['settings', {}],
])
export function validCatalog(data) {
  return (
    data &&
    arrays.every((name) => Array.isArray(data[name])) &&
    data.settings &&
    typeof data.settings === 'object' &&
    !Array.isArray(data.settings)
  )
}
export function readCatalog(storage, now = Date.now()) {
  try {
    const cached = JSON.parse(storage.getItem(key))
    if (
      cached?.version !== 1 ||
      !Number.isFinite(cached.savedAt) ||
      now - cached.savedAt > 86400000 ||
      cached.savedAt > now ||
      !validCatalog(cached.data)
    )
      return null
    return cached.data
  } catch {
    return null
  }
}
export function saveCatalog(storage, data, now = Date.now()) {
  try {
    // Cache public storefront fields only; never account, address or order data.
    const catalog = Object.fromEntries([...arrays, 'settings'].map((name) => [name, data[name]]))
    if (validCatalog(catalog))
      storage.setItem(key, JSON.stringify({ version: 1, savedAt: now, data: catalog }))
  } catch {
    /* Storage may be unavailable or full; rendering must still work. */
  }
}
