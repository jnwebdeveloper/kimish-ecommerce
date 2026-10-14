export function trackCommerce(event, data = {}) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return false
  const allowed = new Set(['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'])
  if (!allowed.has(event)) return false
  window.fbq('track', event, data)
  return true
}
