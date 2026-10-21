import { FileText, ArrowRight, ChevronRight, Mail } from 'lucide-react'
import PageContent from '../components/PageContent'
import './PolicyPage.css'
import About from './About'
import { useState } from 'react'
import { useStore, apiRequest } from '../data/StoreContext'
import { Link, useParams } from 'react-router-dom'

export function Offers() {
  const { coupons } = useStore()
  return (
    <main className="section page-top">
      <div className="page-title">
        <span className="eyebrow">PROMOTIONS</span>
        <h1>Current Offers</h1>
        <p>A little extra goodness with your next order.</p>
      </div>
      <div className="offer-grid">
        {Object.entries(coupons).map(([code, c]) => (
          <article className="promo-card" key={code}>
            <h3>{c.label}</h3>
            <p>Minimum order ₹{c.minCart}</p>
            <code className="offer-code">{code}</code>
            <Link className="kimish-text-link" to="/shop">
              Explore the collection →
            </Link>
          </article>
        ))}
      </div>
    </main>
  )
}

export function TrackOrder() {
  const [orderId, setOrderId] = useState(''),
    [mobile, setMobile] = useState(''),
    [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setError('')
    setResult(null)
    setBusy(true)
    try {
      setResult(await apiRequest('/api/track', { orderId, mobile }))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="section page-top">
      <div className="page-title">
        <span className="eyebrow">DELIVERY STATUS</span>
        <h1>Track your order</h1>
        <p>Your Kimish favourites, on their way to you.</p>
      </div>
      <form className="checkout-card narrow" onSubmit={submit}>
        <div className="tracking-fields">
          <label>
            Order ID
            <input value={orderId} onChange={(e) => setOrderId(e.target.value)} required />
          </label>
          <label>
            Mobile number
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              type="tel"
              pattern="[0-9]{10}"
              required
            />
          </label>
        </div>
        <button disabled={busy} className="btn btn-primary">
          Track order
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <div role="status">
            <h3>{result.status}</h3>
            <p>{result.order_number}</p>
            {result.tracking_number && <p>Tracking reference: {result.tracking_number}</p>}
          </div>
        )}
      </form>
    </main>
  )
}

export function Policy({ pageSlug }) {
  const { pages, settings } = useStore(),
    { slug } = useParams()
  const currentSlug = pageSlug || slug || 'policy'
  const page = pages.find((p) => p.slug === currentSlug)
  if (page?.slug === 'about-us') return <About page={page} />
  const links = [
    ['terms-and-conditions', 'Terms & Conditions'],
    ['privacy-policy', 'Privacy Policy'],
    ['policy', 'Shipping policy'],
    ['contact-us', 'Contact Us'],
  ]
  const title = page?.title || links.find(([key]) => key === currentSlug)?.[1] || 'Page not found'
  return (
    <main className="section page-top policy-document">
      <nav className="policy-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">{title}</span>
      </nav>
      <header className="policy-document-heading">
        <span className="policy-heading-icon" aria-hidden="true">
          <FileText size={26} strokeWidth={1.4} />
        </span>
        <div>
          <h1>{title}</h1>
          <p>
            {currentSlug === 'contact-us'
              ? 'We’re here to help with your Kimish experience.'
              : 'Helpful information for your Kimish experience.'}
          </p>
        </div>
      </header>
      <div className="policy-document-layout">
        <aside className="policy-side">
          <nav aria-label="Information pages">
            <h2>Useful information</h2>
            {links.map(([key, label]) => (
              <Link
                key={key}
                to={key === 'policy' ? '/policy' : `/${key}`}
                aria-current={currentSlug === key ? 'page' : undefined}
              >
                {label}
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <div className="policy-help">
            <Mail size={20} strokeWidth={1.5} />
            <h3>A question in mind?</h3>
            <p>Get in touch with our team. We’re happy to help.</p>
            <Link to="/contact-us">
              Contact us <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </aside>
        <article className="policy-document-content" aria-label={title}>
          {!page && (
            <div className="policy-unpublished">
              <FileText size={36} strokeWidth={1.2} aria-hidden="true" />
              <h2>Content coming soon</h2>
              <p>
                This page hasn’t been published yet. Please contact our team if you need assistance.
              </p>
              <Link to="/contact-us">
                Get in touch <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
          {page?.slug === 'contact-us' && (
            <div className="policy-contact-details">
              {settings.support_email && (
                <p>
                  Email: <a href={`mailto:${settings.support_email}`}>{settings.support_email}</a>
                </p>
              )}
              {settings.support_phone && (
                <p>
                  Phone: <a href={`tel:${settings.support_phone}`}>{settings.support_phone}</a>
                </p>
              )}
              {settings.support_hours && <p>{settings.support_hours}</p>}
            </div>
          )}
          {page && <PageContent value={page.content} />}
        </article>
      </div>
    </main>
  )
}
