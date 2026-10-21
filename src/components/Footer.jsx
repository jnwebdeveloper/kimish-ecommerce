import './Footer.css'
import { useStore } from '../data/StoreContext'
import { Link } from 'react-router-dom'
import { Instagram, MessageCircle, ShieldCheck, Truck } from 'lucide-react'

export default function Footer() {
  const { settings, navigation } = useStore()
  const builtInUrls = new Set([
    '/shop',
    '/shop?sort=popular',
    '/shop?sort=new',
    '/offers',
    '/about-us',
    '/contact-us',
    '/terms-and-conditions',
    '/privacy-policy',
    '/track-order',
    '/policy',
    '/wishlist',
    '/orders',
    '/account',
  ])
  const extraLinks = navigation
    .filter((n) => n.location === 'footer')
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .filter((n) => {
      const url = (n.url || '').trim().replace(/\/$/, '')
      if (!url || builtInUrls.has(url)) return false
      builtInUrls.add(url)
      return true
    })
  return (
    <>
      <footer className="footer footer-refined">
        <div className="footer-brand">
          <img src="/kimish-logo.png" alt="Kimish logo" />
          <p>{settings.footer_description}</p>
          <div className="footer-badges">
            <span>
              <ShieldCheck />
              Secure shopping
            </span>
            <span>
              <Truck />
              PAN India delivery
            </span>
          </div>
        </div>
        <nav aria-label="Footer shopping">
          <h4>Shop</h4>
          <Link to="/shop">All Products</Link>
          <Link to="/shop?sort=popular">Best Sellers</Link>
          <Link to="/shop?sort=new">New Arrivals</Link>
          <Link to="/offers">Offers</Link>
        </nav>
        <nav aria-label="Footer customer care">
          <h4>Customer Care</h4>
          <Link to="/orders">My Orders</Link>
          <Link to="/track-order">Track Order</Link>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/contact-us">Contact Us</Link>
        </nav>
        <div>
          <h4>Stay connected</h4>
          <Link to="/about-us">About Kimish</Link>
          <p>{settings.support_hours}</p>
          {settings.support_phone && (
            <a href={`https://wa.me/${settings.support_phone}`} target="_blank" rel="noreferrer">
              WhatsApp Support
            </a>
          )}
          <p className="muted-light">
            <Instagram size={15} /> {settings.instagram}
          </p>
        </div>
        {extraLinks.length > 0 && (
          <nav className="footer-extra-links" aria-label="More footer links">
            {extraLinks.map((n) => (
              <Link
                key={n.id}
                to={n.url}
                target={n.open_new_tab ? '_blank' : undefined}
                rel={n.open_new_tab ? 'noopener noreferrer' : undefined}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </footer>
      <div className="footer-bottom footer-legal">
        <span>© {new Date().getFullYear()} Kimish. All rights reserved.</span>
        <nav aria-label="Store policies">
          <Link to="/policy">Shipping &amp; No Returns</Link>
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
        </nav>
      </div>
      {settings.support_phone && (
        <a
          className="whatsapp"
          href={`https://wa.me/${settings.support_phone}`}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp support"
        >
          <MessageCircle size={24} />
        </a>
      )}
    </>
  )
}
