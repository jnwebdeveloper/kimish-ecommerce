import { randomBytes } from 'node:crypto'

// The suffix lets products with the same display name have distinct URLs.
export function automaticSlug(name) {
  const base =
    String(name || 'item')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100)
      .replace(/-$/, '') || 'item'
  return `${base}-${randomBytes(6).toString('hex')}`
}
