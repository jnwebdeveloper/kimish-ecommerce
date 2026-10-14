import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Gift, Sparkles, ShieldCheck, Truck } from 'lucide-react'
import { useStore } from '../data/StoreContext'

export default function CustomisedGifts() {
  const { gift_boxes = [] } = useStore()
  return (
    <main className="section page-top gifts-list-page">
      <div className="gift-list-hero">
        <span className="eyebrow">CUSTOMISED GIFTS</span>
        <h1>Thoughtfully curated. Beautifully personal.</h1>
        <p>
          Discover Kimish gift boxes for weddings, festivals, corporate milestones and special
          moments.
        </p>
      </div>
      <div className="gift-list-grid">
        {gift_boxes.map((g) => (
          <article className="gift-list-card" key={g.id}>
            <div className="gift-list-image">
              <Link to={`/customised-gifts/${g.slug}`}>
                <img src={g.image} alt={g.name} />
              </Link>
              <span>{g.occasion}</span>
            </div>
            <div className="gift-list-copy">
              <h2>
                <Link to={`/customised-gifts/${g.slug}`}>{g.name}</Link>
              </h2>
              <p>{g.description}</p>
              {Number(g.price) > 0 && <strong>₹{Number(g.price).toLocaleString('en-IN')}</strong>}
              <Link to={`/customised-gifts/${g.slug}`}>
                View gift box <ArrowRight size={16} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <section className="gift-service-band">
        <div>
          <Gift />
          <strong>Made for every occasion</strong>
          <span>Curated formats for personal and corporate gifting.</span>
        </div>
        <div>
          <Sparkles />
          <strong>Personalisation support</strong>
          <span>Choose presentation and assortment details for your requirement.</span>
        </div>
      </section>
    </main>
  )
}

export function GiftDetail() {
  const { slug } = useParams()
  const { gift_boxes = [] } = useStore()
  const g = gift_boxes.find((x) => x.slug === slug)
  if (!g)
    return (
      <main className="section page-top">
        <h1>Gift box not found</h1>
      </main>
    )
  const points = String(g.about_item || '')
    .split('\n')
    .filter(Boolean)
  return (
    <main className="section page-top">
      <div className="product-detail">
        <div className="detail-gallery">
          <img className="detail-main-image" src={g.image} alt={g.name} />
        </div>
        <div className="detail-info">
          <span className="eyebrow">{g.occasion || 'CUSTOMISED GIFTING'}</span>
          <h1>{g.name}</h1>
          <p>{g.description}</p>
          {Number(g.price) > 0 && (
            <div className="detail-price">
              <strong>₹{Number(g.price).toLocaleString('en-IN')}</strong>
              {Number(g.mrp) > Number(g.price) && (
                <del>₹{Number(g.mrp).toLocaleString('en-IN')}</del>
              )}
            </div>
          )}
          <div className="detail-points">
            <div>
              <Truck size={20} />
              <span>PAN India delivery subject to serviceability</span>
            </div>
            <div>
              <ShieldCheck size={20} />
              <span>Secure checkout and careful gift presentation</span>
            </div>
          </div>
          <section className="product-facts">
            <div className="about-item-panel">
              <span className="eyebrow">GIFT DETAILS</span>
              <h2>About this gift box</h2>
              <ul>
                {points.map((x, i) => (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <p>{x}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="product-care-grid">
              <article>
                <span>01</span>
                <h4>Box contents</h4>
                <p>{g.contents || 'Curated contents can be configured for this gift box.'}</p>
              </article>
              <article>
                <span>02</span>
                <h4>Personalisation</h4>
                <p>{g.personalisation || 'Contact Kimish for customisation options.'}</p>
              </article>
              <article>
                <span>03</span>
                <h4>SKU & stock</h4>
                <p>
                  {g.sku || '—'} · {g.stock} available
                </p>
              </article>
            </div>
          </section>
          <Link className="btn btn-primary" to="/pages/contact">
            Enquire for customisation
          </Link>
        </div>
      </div>
    </main>
  )
}
