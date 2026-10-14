import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, MapPin, PackageCheck } from 'lucide-react'

export default function OrderConfirmation() {
  const location = useLocation()
  let order = location.state?.order
  if (!order)
    return (
      <main className="section page-top">
        <div className="empty-state">
          <h1>No recent order found</h1>
          <Link className="btn btn-primary" to="/shop">
            Shop Kimish
          </Link>
        </div>
      </main>
    )
  return (
    <main className="section page-top confirmation-page">
      <div className="confirmation-hero">
        <CheckCircle2 />
        <span className="eyebrow">ORDER CONFIRMED</span>
        <h1>Thank you, {order.customer.name}.</h1>
        <p>
          Your order <strong>#{order.id}</strong> has been received. You can track it anytime using
          your order ID and mobile number.
        </p>
      </div>
      <div className="confirmation-grid">
        <section className="checkout-card">
          <div className="checkout-heading">
            <PackageCheck />
            <h3>Order details</h3>
          </div>
          {order.items.map((i) => (
            <div className="summary-line" key={`${i.product.id}-${i.variant.weight}`}>
              <span>
                {i.product.name} · {i.variant.weight} × {i.qty}
              </span>
              <strong>₹{i.variant.price * i.qty}</strong>
            </div>
          ))}
          <div className="summary-line total">
            <span>Total paid / payable</span>
            <strong>₹{order.total}</strong>
          </div>
          <p className="muted">
            Payment: {order.payment === 'cod' ? 'Cash on Delivery' : order.payment.toUpperCase()}
          </p>
        </section>
        <section className="checkout-card">
          <div className="checkout-heading">
            <MapPin />
            <h3>Delivery address</h3>
          </div>
          <p>
            <strong>{order.customer.name}</strong>
            <br />
            {order.customer.address}
            {order.customer.landmark ? `, ${order.customer.landmark}` : ''}
            <br />
            {order.customer.city}, {order.customer.state} – {order.customer.pincode}
            <br />
            {order.customer.mobile}
          </p>
          <Link className="btn btn-secondary full" to="/track-order">
            Track Order
          </Link>
        </section>
      </div>
      <div className="confirmation-actions">
        <Link className="btn btn-primary" to="/shop">
          Continue Shopping
        </Link>
      </div>
    </main>
  )
}
