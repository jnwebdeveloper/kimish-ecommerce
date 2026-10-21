import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Package } from 'lucide-react'
import { authRequest } from '../auth/AuthContext'
import './Orders.css'
const money = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0))
const date = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
export default function Orders({ user, onSignOut, busy, signOutError }) {
  const { orderNumber } = useParams()
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setResult(null)
    setError('')
    authRequest(orderNumber ? `orders/${encodeURIComponent(orderNumber)}` : 'orders')
      .then((data) => {
        if (active) setResult(data)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [orderNumber, user.phone, retry])
  const address = result?.customer_snapshot || {}
  return (
    <main className="section page-top orders-page">
      <header className="orders-heading">
        <div>
          <span className="eyebrow">YOUR KIMISH COLLECTION</span>
          <h1>{orderNumber ? 'Order details' : 'My Orders'}</h1>
          <p>
            {orderNumber
              ? 'Everything you need to know about your order.'
              : 'Your purchases, payment status and delivery details in one place.'}
          </p>
        </div>
        <button className="btn btn-outline" onClick={onSignOut} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </header>
      {orderNumber && (
        <Link className="orders-back" to="/orders">
          <ArrowLeft size={16} />
          Back to My Orders
        </Link>
      )}
      {signOutError && <p role="alert">{signOutError}</p>}
      {loading ? (
        <p role="status">Loading your orders…</p>
      ) : error ? (
        <div className="orders-empty">
          <p role="alert">{error}</p>
          <button className="btn btn-outline" onClick={() => setRetry((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : orderNumber && result?.items ? (
        <>
          <section className="order-overview">
            <div>
              <span className="eyebrow">ORDER NUMBER</span>
              <h2>{result.order_number}</h2>
              <p>Placed on {date(result.created_at)}</p>
            </div>
            <span className="order-status">{result.status}</span>
          </section>
          <div className="order-detail-grid">
            <section className="order-panel">
              <h2>Items in your order</h2>
              <div className="order-items">
                {result.items.map((item) => (
                  <article key={item.id}>
                    <div>
                      <h3>{item.product_name}</h3>
                      <p>
                        {item.weight} · Quantity: {item.quantity}
                      </p>
                      <p>{money(item.price)} each</p>
                    </div>
                    <strong>{money(Number(item.price) * item.quantity)}</strong>
                  </article>
                ))}
              </div>
              <div className="order-totals">
                <p>
                  <span>Subtotal</span>
                  <span>{money(result.subtotal)}</span>
                </p>
                <p>
                  <span>Discount</span>
                  <span>−{money(result.discount)}</span>
                </p>
                <p>
                  <span>Shipping</span>
                  <span>{money(result.shipping)}</span>
                </p>
                <p className="order-total">
                  <strong>Order total</strong>
                  <strong>{money(result.total)}</strong>
                </p>
              </div>
            </section>
            <aside className="order-side">
              <section className="order-panel">
                <h2>Delivery address</h2>
                <p>
                  <strong>{address.name}</strong>
                  <br />
                  {address.address}
                  {address.landmark && `, ${address.landmark}`}
                  <br />
                  {address.city}, {address.state} – {address.pincode}
                  <br />
                  {address.mobile}
                </p>
                {result.tracking_number && (
                  <p>
                    <strong>Tracking number</strong>
                    <br />
                    {result.tracking_number}
                  </p>
                )}
              </section>
              <section className="order-panel">
                <h2>Payment</h2>
                <p>{result.payment === 'cod' ? 'Cash on Delivery' : 'Online payment'}</p>
                <span className="order-status">{result.payment_status}</span>
              </section>
            </aside>
          </div>
        </>
      ) : result?.orders?.length ? (
        <div className="orders-list">
          {result.orders.map((order) => (
            <Link
              className="order-list-card"
              key={order.order_number}
              to={`/orders/${encodeURIComponent(order.order_number)}`}
            >
              <div className="order-list-title">
                <Package size={24} />
                <div>
                  <h2>{order.order_number}</h2>
                  <p>{date(order.created_at)}</p>
                </div>
              </div>
              <div>
                <span className="order-status">{order.status}</span>
                <p>Payment: {order.payment_status}</p>
              </div>
              <div className="order-list-total">
                <strong>{money(order.total)}</strong>
                <span>
                  View details <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <section className="orders-empty">
          <Package size={40} />
          <h2>No orders yet</h2>
          <p>Orders placed with your verified mobile number will appear here.</p>
          <Link className="btn btn-primary" to="/shop">
            Explore the collection
          </Link>
        </section>
      )}
    </main>
  )
}
