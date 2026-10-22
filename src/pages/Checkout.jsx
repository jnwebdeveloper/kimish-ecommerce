import './CheckoutDelivery.css'
import { useAuth } from '../auth/AuthContext'
import { trackCommerce } from '../data/pixel.js'
import { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiRequest, useStore } from '../data/StoreContext'
import { validateDelivery } from '../data/deliveryValidation'
import { CreditCard, MapPin, Package, ShieldCheck, Smartphone } from 'lucide-react'

// The storefront ships only with Shiprocket and takes only online payment (Razorpay)
const payment = 'razorpay'
const shippingMethod = 'shiprocket'

export default function Checkout({ cart, clearCart }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { coupons, refresh } = useStore()
  const location = useLocation()
  const couponCode = location.state?.couponCode || ''
  const [error, setError] = useState(''),
    [fieldErrors, setFieldErrors] = useState({}),
    [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    email: '',
    pincode: '',
    address: '',
    landmark: '',
    city: '',
    state: '',
  })
  const [rates, setRates] = useState({ key: '', couriers: [] }),
    [courierId, setCourierId] = useState(''),
    [ratesBusy, setRatesBusy] = useState(false),
    [ratesError, setRatesError] = useState('')
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.variant.price * item.qty, 0),
    [cart],
  )
  // Rates depend on pincode and cart weight; a quote is only usable while both are unchanged.
  const ratesKey = `${form.pincode}|${cart.map((i) => `${i.variant.id}:${i.qty}`).join(',')}`
  const ratesFresh = rates.key === ratesKey
  const courier = ratesFresh ? rates.couriers.find((c) => c.id === courierId) : undefined
  const shipping = courier?.rate ?? 0
  const coupon = coupons[couponCode]
  const discount =
    coupon && subtotal >= coupon.minCart
      ? Math.min(
          subtotal,
          coupon.type === 'percent' ? Math.round(subtotal * coupon.value) / 100 : coupon.value,
        )
      : 0
  const total = subtotal - discount + shipping

  const setField = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }
  const message = (name) =>
    fieldErrors[name] && (
      <small className="field-error" role="alert" id={`${name}-error`}>
        {fieldErrors[name]}
      </small>
    )

  async function checkRates() {
    if (!/^\d{6}$/.test(form.pincode)) {
      setFieldErrors((prev) => ({ ...prev, pincode: 'Enter a valid 6-digit PIN code.' }))
      setRatesError('Enter your delivery PIN code in step 1 first.')
      return
    }
    setRatesBusy(true)
    setRatesError('')
    try {
      const key = ratesKey
      const data = await apiRequest('/api/shipping/rates', {
        pincode: form.pincode,
        payment,
        items: cart.map((i) => ({ variantId: i.variant.id, qty: i.qty })),
      })
      setRates({ key, couriers: data.couriers })
      setCourierId(data.couriers[0]?.id || '')
      if (!data.couriers.length)
        setRatesError('No couriers deliver to this PIN code. Please check the PIN code.')
    } catch (error) {
      setRatesError(error.message)
    } finally {
      setRatesBusy(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!cart.length || busy) return
    const errors = validateDelivery(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      setError('Please correct the highlighted delivery fields.')
      return
    }
    if (!courier) {
      setError(
        rates.couriers.length && !ratesFresh
          ? 'Your PIN code or cart changed. Check shipping rates again.'
          : 'Check shipping rates and choose a courier.',
      )
      return
    }
    setBusy(true)
    setError('')
    try {
      if (!window.Razorpay)
        throw new Error('Razorpay checkout could not be loaded. Please refresh and try again.')
      const order = await apiRequest(user ? '/api/auth/checkout' : '/api/orders', {
        customer: form,
        payment,
        shippingMethod,
        courierId: courier?.id,
        shippingQuote: courier?.rate,
        items: cart.map((i) => ({ variantId: i.variant.id, qty: i.qty })),
        couponCode,
      })
      let failure = ''
      await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: order.razorpay.keyId,
          order_id: order.razorpay.orderId,
          amount: order.razorpay.amount,
          currency: order.razorpay.currency,
          name: order.razorpay.name,
          description: order.razorpay.description,
          prefill: { name: form.name, email: form.email, contact: form.mobile },
          theme: { color: '#55723f' },
          handler: async (response) => {
            try {
              await apiRequest('/api/payments/razorpay/verify', {
                orderNumber: order.id,
                ...response,
              })
              resolve()
            } catch (e) {
              reject(e)
            }
          },
          modal: {
            ondismiss: () => {
              apiRequest('/api/payments/razorpay/cancel', {
                orderNumber: order.id,
                razorpay_order_id: order.razorpay.orderId,
              })
                .then(() => refresh())
                .catch(() => {})
              reject(
                new Error(
                  `${failure || 'Payment was cancelled.'} Your order has not been placed and you have not been charged.`,
                ),
              )
            },
          },
        })
        checkout.on('payment.failed', (r) => {
          failure = r.error?.description || 'Payment failed.'
        })
        checkout.open()
      })
      trackCommerce('Purchase', {
        value: Number(order.total),
        currency: 'INR',
        content_ids: order.items.map((i) => String(i.product.id)),
        content_type: 'product',
        num_items: order.items.reduce((n, i) => n + i.qty, 0),
      })
      clearCart()
      navigate('/order-confirmation', {
        state: { order: { ...order, payment_status: 'Paid' } },
      })
      refresh().catch(() => {})
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (!cart.length)
    return (
      <main className="section page-top">
        <div className="empty-state">
          <h1>Your cart is empty</h1>
          <p>Add products before continuing to checkout.</p>
          <button className="btn btn-primary" onClick={() => navigate('/shop')}>
            Continue Shopping
          </button>
        </div>
      </main>
    )

  return (
    <main className="section page-top guest-checkout">
      <div className="page-title">
        <span className="eyebrow">GUEST CHECKOUT</span>
        <h1>Complete your order</h1>
        <p>
          No account needed. Enter your delivery details, choose a courier and pay securely online.
        </p>
      </div>
      <div className="checkout-steps">
        <span className="active">
          1 <b>Delivery</b>
        </span>
        <i></i>
        <span className="active">
          2 <b>Shipping</b>
        </span>
        <i></i>
        <span className="active">
          3 <b>Review & Pay</b>
        </span>
        <i></i>
        <span>
          4 <b>Confirmation</b>
        </span>
      </div>
      <form className="checkout-grid" onSubmit={submit} noValidate>
        <div className="checkout-stack">
          <section className="checkout-card delivery-details-card">
            <div className="checkout-heading">
              <MapPin />
              <div>
                <span className="eyebrow">STEP 1</span>
                <h3>Delivery details</h3>
              </div>
            </div>
            <p className="delivery-intro">Tell us where to send your Kimish favourites.</p>
            <div className="form-grid guest-form">
              <div className="delivery-group-label span-2">Contact information</div>
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                  value={form.name}
                  onChange={setField}
                  required
                  placeholder="Your full name"
                />
                {message('name')}
              </label>
              <label>
                Mobile number
                <input
                  name="mobile"
                  type="tel"
                  maxLength={10}
                  autoComplete="tel-national"
                  aria-invalid={Boolean(fieldErrors.mobile)}
                  aria-describedby={fieldErrors.mobile ? 'mobile-error' : undefined}
                  value={form.mobile}
                  onChange={setField}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  placeholder="10-digit mobile number"
                />
                {message('mobile')}
              </label>
              <label className="span-2">
                Email <small>(for order updates)</small>
                <input
                  name="email"
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  value={form.email}
                  onChange={setField}
                  type="email"
                  placeholder="you@example.com"
                />
                {message('email')}
              </label>
              <div className="delivery-group-label delivery-address-label span-2">
                Delivery address
              </div>
              <label>
                PIN code
                <input
                  name="pincode"
                  maxLength={6}
                  autoComplete="postal-code"
                  aria-invalid={Boolean(fieldErrors.pincode)}
                  aria-describedby={fieldErrors.pincode ? 'pincode-error' : undefined}
                  value={form.pincode}
                  onChange={setField}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  placeholder="6-digit PIN code"
                />
                {message('pincode')}
              </label>
              <label>
                City
                <input
                  name="city"
                  autoComplete="address-level2"
                  aria-invalid={Boolean(fieldErrors.city)}
                  aria-describedby={fieldErrors.city ? 'city-error' : undefined}
                  value={form.city}
                  onChange={setField}
                  required
                  placeholder="City"
                />
                {message('city')}
              </label>
              <label className="span-2">
                House / Flat / Street
                <input
                  name="address"
                  autoComplete="street-address"
                  aria-invalid={Boolean(fieldErrors.address)}
                  aria-describedby={fieldErrors.address ? 'address-error' : undefined}
                  value={form.address}
                  onChange={setField}
                  required
                  placeholder="Complete delivery address"
                />
                {message('address')}
              </label>
              <label>
                Landmark <small>(optional)</small>
                <input
                  name="landmark"
                  value={form.landmark}
                  onChange={setField}
                  placeholder="Nearby landmark"
                />
                {message('landmark')}
              </label>
              <label>
                State
                <input
                  name="state"
                  autoComplete="address-level1"
                  aria-invalid={Boolean(fieldErrors.state)}
                  aria-describedby={fieldErrors.state ? 'state-error' : undefined}
                  value={form.state}
                  onChange={setField}
                  required
                  placeholder="State"
                />
                {message('state')}
              </label>
            </div>
          </section>

          <section className="checkout-card">
            <div className="checkout-heading">
              <Package />
              <div>
                <span className="eyebrow">STEP 2</span>
                <h3>Shipping</h3>
              </div>
            </div>
            <div className="shipping-rates">
              <div className="secure-note">
                <ShieldCheck size={20} />
                <span>
                  Check courier rates for your delivery PIN code and choose the courier you prefer.
                  Delivery is handled through Shiprocket.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                onClick={checkRates}
                disabled={ratesBusy}
              >
                {ratesBusy ? 'Checking rates…' : 'Check shipping rates'}
              </button>
              <small className="shipping-hint">
                Enter your pincode, then check shipping rates. Check again after changing quantity
                or pincode.
              </small>
              {ratesError && (
                <p role="alert" className="error">
                  {ratesError}
                </p>
              )}
              {rates.couriers.length > 0 && !ratesFresh && (
                <p role="status" className="error">
                  Your PIN code or cart changed. Check shipping rates again.
                </p>
              )}
              {ratesFresh && rates.couriers.length > 0 && (
                <div className="payment-options">
                  {rates.couriers.map((c) => (
                    <label key={c.id} className={courierId === c.id ? 'selected' : ''}>
                      <input
                        type="radio"
                        name="courier"
                        value={c.id}
                        checked={courierId === c.id}
                        onChange={(e) => setCourierId(e.target.value)}
                      />
                      <span>
                        <strong>
                          {c.name} · ₹{c.rate}
                        </strong>
                        {(c.etd || c.days) && (
                          <small>{c.etd ? `Estimated delivery ${c.etd}` : `${c.days} days`}</small>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="checkout-card">
            <div className="checkout-heading">
              <CreditCard />
              <div>
                <span className="eyebrow">STEP 3</span>
                <h3>Payment</h3>
              </div>
            </div>
            <div className="payment-options">
              <label className="selected static">
                <Smartphone />
                <span>
                  <strong>Pay Online</strong>
                  <small>UPI, cards, net banking & wallets via Razorpay</small>
                </span>
              </label>
            </div>
            <div className="secure-note">
              <ShieldCheck size={20} />
              <span>Online payments are securely processed by Razorpay.</span>
            </div>
          </section>
        </div>

        <aside className="summary-card checkout-summary">
          <h3>Final Review</h3>
          <div className="review-products">
            {cart.map((i) => (
              <div className="review-product" key={`${i.product.id}-${i.variant.weight}`}>
                <img src={i.product.images[0]} alt="" />
                <div>
                  <strong>{i.product.name}</strong>
                  <span>
                    {i.variant.weight} · Qty {i.qty}
                  </span>
                </div>
                <b>₹{i.variant.price * i.qty}</b>
              </div>
            ))}
          </div>
          <div className="summary-line">
            <span>Subtotal</span>
            <strong>₹{subtotal}</strong>
          </div>
          <div className="summary-line">
            <span>Shipping</span>
            <strong>{!courier ? 'Check rates' : shipping ? `₹${shipping}` : 'Free'}</strong>
          </div>
          {discount > 0 && (
            <div className="summary-line">
              <span>Discount</span>
              <strong>− ₹{discount}</strong>
            </div>
          )}
          <div className="summary-line total">
            <span>Total</span>
            <strong>₹{total}</strong>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button disabled={busy} className="btn btn-primary full" type="submit">
            {busy ? 'Placing order…' : `Pay ₹${total}`}
          </button>
          <small>By placing your order, you agree to the shipping and food-product policies.</small>
        </aside>
      </form>
    </main>
  )
}
