import { contentText } from '../utils/richText'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../data/StoreContext'

const upsert = (selector, attrs) => {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
  return el
}
export default function Seo() {
  const { products = [], gift_boxes = [], settings = {}, seo_pages = [], pages = [] } = useStore()
  const location = useLocation()
  const lastPixelView = useRef('')
  useEffect(() => {
    const product = location.pathname.startsWith('/product/')
      ? products.find((p) => `/product/${p.slug}` === location.pathname)
      : null
    const gift = location.pathname.startsWith('/customised-gifts/')
      ? gift_boxes.find((g) => `/customised-gifts/${g.slug}` === location.pathname)
      : null
    const seo = seo_pages.find((page) => page.path === location.pathname)
    const pageSlug = location.pathname.replace(/^\/pages\//, '').replace(/^\//, '')
    const page = pages.find((p) => p.slug === pageSlug)
    const title =
      seo?.title ||
      (product
        ? `${product.name} | Kimish`
        : gift
          ? gift.seo_title || `${gift.name} | Kimish`
          : location.pathname === '/shop'
            ? 'Shop Premium Nuts, Seeds & Dry Fruits | Kimish'
            : page
              ? `${page.title} | Kimish`
              : settings.seo_title || 'Kimish | Premium Nuts, Seeds, Dry Fruits & Gifts')
    const description =
      seo?.description ||
      (product
        ? product.description || 'Shop premium Kimish products online.'
        : gift
          ? gift.seo_description || gift.description
          : page
            ? contentText(page.content).slice(0, 160)
            : settings.seo_description ||
              'Discover premium nuts, seeds, dry fruits, roasted favourites and customised gift boxes from Kimish.')
    document.title = title
    upsert('meta[name="description"]', { name: 'description', content: description })
    upsert('meta[property="og:title"]', { property: 'og:title', content: title })
    upsert('meta[property="og:description"]', { property: 'og:description', content: description })
    upsert('meta[property="og:type"]', {
      property: 'og:type',
      content: product || gift ? 'product' : 'website',
    })
    const canonicalBase = (settings.site_url || window.location.origin).replace(/\/$/, '')
    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = canonicalBase + location.pathname
    upsert('meta[name="robots"]', {
      name: 'robots',
      content:
        seo?.noindex ||
        location.pathname.startsWith('/admin') ||
        location.pathname.startsWith('/checkout') ||
        location.pathname.startsWith('/account')
          ? 'noindex,nofollow'
          : 'index,follow',
    })
    upsert('meta[property="og:url"]', { property: 'og:url', content: canonical.href })
    upsert('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
    const sharingImage = seo?.image || product?.image || gift?.image
    if (sharingImage)
      upsert('meta[property="og:image"]', {
        property: 'og:image',
        content: new URL(sharingImage, canonicalBase).href,
      })
    else document.head.querySelector('meta[property="og:image"]')?.remove()
    const structured = document.getElementById('kimish-jsonld') || document.createElement('script')
    structured.id = 'kimish-jsonld'
    structured.type = 'application/ld+json'
    structured.textContent = JSON.stringify(
      product
        ? {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description,
            image: product.image ? [new URL(product.image, canonicalBase).href] : undefined,
            url: canonical.href,
          }
        : {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Kimish',
            url: canonicalBase,
          },
    )
    document.head.appendChild(structured)
  }, [location.pathname, products, gift_boxes, settings, seo_pages, pages])

  useEffect(() => {
    const pixel = String(settings.meta_pixel_id || '').trim()
    window.kimishPixelId = /^\d{5,30}$/.test(pixel) ? pixel : ''
    if (!window.kimishPixelId) {
      lastPixelView.current = ''
      return
    }
    if (pixel && !window.fbq) {
      !(function (f, b, e, v, n, t, s) {
        if (f.fbq) return
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
        }
        if (!f._fbq) f._fbq = n
        n.push = n
        n.loaded = !0
        n.version = '2.0'
        n.queue = []
        t = b.createElement(e)
        t.async = !0
        t.src = v
        s = b.getElementsByTagName(e)[0]
        s.parentNode.insertBefore(t, s)
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
    }
    window.kimishPixels ||= new Set()
    if (!window.kimishPixels.has(pixel)) {
      window.fbq('init', pixel)
      window.kimishPixels.add(pixel)
    }
    const view = pixel + ':' + location.pathname
    if (window.fbq && lastPixelView.current !== view) {
      window.fbq('trackSingle', pixel, 'PageView')
      lastPixelView.current = view
    }
  }, [location.pathname, settings.meta_pixel_id])
  return null
}
