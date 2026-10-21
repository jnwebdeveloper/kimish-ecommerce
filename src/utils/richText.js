import DOMPurify from 'dompurify'
export const RICH_TEXT_PREFIX = '<!--kimish-rich-text-v1-->'
export const isRichText = (value = '') => String(value).startsWith(RICH_TEXT_PREFIX)
export const sanitizeRichText = (html = '') =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'div',
      'h2',
      'h3',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
    ],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  })
const escapeHtml = (text) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
export function contentHtml(value = '') {
  return isRichText(value)
    ? sanitizeRichText(value.slice(RICH_TEXT_PREFIX.length))
    : String(value)
        .split(/\n\n+/)
        .map((p) => `<p>${escapeHtml(p).replaceAll('\n', '<br>')}</p>`)
        .join('')
}
export function contentText(value = '') {
  if (!isRichText(value)) return String(value)
  const element = document.createElement('div')
  element.innerHTML = contentHtml(value)
  element.querySelectorAll('br').forEach((node) => node.replaceWith('\n'))
  element.querySelectorAll('p,div,h2,h3,li,blockquote').forEach((node) => node.append('\n'))
  return (element.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}
export const richValue = (html) => RICH_TEXT_PREFIX + sanitizeRichText(html)
