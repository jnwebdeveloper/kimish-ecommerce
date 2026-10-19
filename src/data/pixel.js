export function trackCommerce(event, data = {}) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function' || !window.kimishPixelId)
    return false
  const allowed = new Set(['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'])
  if (!allowed.has(event)) return false
  window.fbq('trackSingle', window.kimishPixelId, event, data)
  return true
}
