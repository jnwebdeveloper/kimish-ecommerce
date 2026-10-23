import './Cart.css'
import { Trash2, Minus, Plus, ArrowLeft } from 'lucide-react'
import StoreImage from '../components/StoreImage'
import { Link } from 'react-router-dom'
import { useStore } from '../data/StoreContext'
import { useState } from 'react'

export default function Cart({ cart, updateQty, removeFromCart }) {
  const { coupons, settings } = useStore()
  const [couponInput, setCouponInput] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const subtotal = cart.reduce((sum, item) => sum + item.variant.price * item.qty, 0)
  const coupon = coupons[couponCode]
  let discount = 0
  if (coupon && subtotal >= coupon.minCart) {
    discount =
      coupon.type === 'percent' ? Math.round((subtotal * coupon.value) / 100) : coupon.value
  }
  const shipping =
    subtotal >= Number(settings.free_shipping_threshold || 499) || subtotal === 0
      ? 0
      : Number(settings.shipping_fee || 79)
  const total = Math.max(0, subtotal - discount + shipping)

  function applyCoupon() {
    const code = couponInput.trim().toUpperCase()
    setCouponCode(coupons[code] ? code : 'INVALID')
  }

  return (
    <main className="section page-top refined-cart-page">
      <div className="page-title">
        <span className="eyebrow">YOUR BAG</span>
        <h1>Shopping Cart</h1>
        <p>Good ingredients, ready for your everyday moments.</p>
      </div>
      {!cart.length ? (
        <div className="empty-state">
          <h3>Your cart is empty</h3>
          <Link className="btn btn-primary" to="/shop">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <section className="cart-list" aria-label="Items in your cart">
            <div className="cart-list-heading">
              <h2>
                Your items <span>{cart.reduce((sum, item) => sum + item.qty, 0)}</span>
              </h2>
              <Link to="/shop">
                <ArrowLeft size={14} /> Continue shopping
              </Link>
            </div>
            {cart.map((item) => (
              <div className="cart-item" key={`${item.product.id}-${item.variant.weight}`}>
                <Link className="cart-product-photo" to={`/product/${item.product.slug}`}>
                  <StoreImage src={item.product.images[0]} alt={item.product.name} />
                </Link>
                <div className="grow">
                  <Link className="cart-product-title" to={`/product/${item.product.slug}`}>
                    {item.product.name}
                  </Link>
                  <span className="cart-pack-label">
                    {item.variant.weight} pack <span>· ₹{item.variant.price} each</span>
                  </span>
                  <div className="qty">
                    <button
                      disabled={item.qty <= 1}
                      aria-label={`Decrease quantity of ${item.product.name}`}
                      onClick={() => updateQty(item, Math.max(1, item.qty - 1))}
                    >
                      <Minus size={14} />
                    </button>
                    <span>{item.qty}</span>
                    <button
                      aria-label={`Increase quantity of ${item.product.name}`}
                      onClick={() => updateQty(item, item.qty + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="cart-price">
                  <strong>₹{item.variant.price * item.qty}</strong>
                  <button
                    className="link-btn cart-remove"
                    title="Remove item"
                    aria-label={`Remove ${item.product.name} from cart`}
                    onClick={() => removeFromCart(item)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </section>

          <aside className="summary-card">
            <h3>Order Summary</h3>
            <div className="coupon-row">
              <input
                aria-label="Coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Coupon code"
              />
              <button onClick={applyCoupon}>Apply</button>
            </div>
            {couponCode && couponCode !== 'INVALID' && (
              <p className="success">Coupon {couponCode} applied.</p>
            )}
            {couponCode === 'INVALID' && <p className="error">Invalid coupon code.</p>}
            <div className="summary-line">
              <span>Subtotal</span>
              <strong>₹{subtotal}</strong>
            </div>
            <div className="summary-line">
              <span>Discount</span>
              <strong>− ₹{discount}</strong>
            </div>
            <div className="summary-line">
              <span>Shipping</span>
              <strong>{shipping ? `₹${shipping}` : 'Free'}</strong>
            </div>
            <div className="summary-line total">
              <span>Total</span>
              <strong>₹{total}</strong>
            </div>
            <Link
              className="btn btn-primary full"
              to="/checkout"
              state={{ couponCode: discount ? couponCode : '' }}
            >
              Proceed to Checkout
            </Link>
            <small>Secure checkout • Guest checkout available</small>
          </aside>
        </div>
      )}
    </main>
  )
}
