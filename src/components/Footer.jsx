import { useStore } from '../data/StoreContext'
import { Link } from 'react-router-dom'
import { Instagram, MessageCircle, ShieldCheck, Truck } from 'lucide-react'

export default function Footer() {
  const { settings, navigation } = useStore()
  return (
    <>
      <footer className="footer">
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
        <div>
          <h4>Shop</h4>
          <Link to="/shop">All Products</Link>
          <Link to="/shop?sort=popular">Best Sellers</Link>
          <Link to="/shop?sort=new">New Arrivals</Link>
          <Link to="/offers">Offers</Link>
        </div>
        <div>
          <h4>Customer Care</h4>
          <Link to="/track-order">Track Order</Link>
          <Link to="/policy">Shipping & No Returns</Link>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/account">My account</Link>
          {navigation
            .filter((n) => n.location === 'footer')
            .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
            .map((n) => (
              <Link
                key={n.id}
                to={n.url}
                target={n.open_new_tab ? '_blank' : undefined}
                rel={n.open_new_tab ? 'noopener noreferrer' : undefined}
              >
                {n.label}
              </Link>
            ))}
        </div>
        <div>
          <h4>Stay connected</h4>
          <p>{settings.support_hours}</p>
          <a href={`https://wa.me/${settings.support_phone}`} target="_blank" rel="noreferrer">
            WhatsApp Support
          </a>
          <p className="muted-light">
            <Instagram size={15} /> {settings.instagram}
          </p>
        </div>
      </footer>
      <div className="footer-bottom">© 2026 Kimish. Premium dry fruits, nuts & seeds.</div>
      <a
        className="whatsapp"
        href={`https://wa.me/${settings.support_phone}`}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp support"
      >
        <MessageCircle size={24} />
      </a>
    </>
  )
}
