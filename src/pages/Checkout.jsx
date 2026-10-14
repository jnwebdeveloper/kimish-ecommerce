import { trackCommerce } from '../data/pixel.js'
import { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiRequest, useStore } from '../data/StoreContext'
import { validateDelivery } from '../data/deliveryValidation'
import { CreditCard, Home, MapPin, Package, PackageCheck, ShieldCheck, Smartphone, Truck } from 'lucide-react'

export default function Checkout({ cart, clearCart }) {
  const navigate = useNavigate()
  const {settings,coupons,refresh}=useStore()
  const location=useLocation()
  const couponCode=location.state?.couponCode||''
  const [error,setError]=useState(''),[fieldErrors,setFieldErrors]=useState({}),[busy,setBusy]=useState(false)
  const [payment, setPayment] = useState('razorpay')
  const [form, setForm] = useState({ name:'', mobile:'', email:'', pincode:'', address:'', landmark:'', city:'', state:'' })
  const methods = useMemo(() => { const list=String(settings.shipping_methods||'shiprocket,none,inhouse').split(',').map(m=>m.trim()).filter(m=>['shiprocket','none','inhouse'].includes(m)); return list.length?list:['inhouse'] }, [settings.shipping_methods])
  const [chosenMethod, setShippingMethod] = useState('')
  const shippingMethod = methods.includes(chosenMethod) ? chosenMethod : methods[0]
  const [rates,setRates]=useState({key:'',couriers:[]}),[courierId,setCourierId]=useState(''),[ratesBusy,setRatesBusy]=useState(false),[ratesError,setRatesError]=useState('')
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.variant.price * item.qty, 0), [cart])
  // Rates depend on pincode, cart weight and COD; a quote is only usable while all three are unchanged.
  const ratesKey = `${form.pincode}|${payment}|${cart.map(i=>`${i.variant.id}:${i.qty}`).join(',')}`
  const ratesFresh = rates.key === ratesKey
  const courier = ratesFresh ? rates.couriers.find(c => c.id === courierId) : undefined
  const inhouseShipping = subtotal >= Number(settings.free_shipping_threshold||499) || subtotal === 0 ? 0 : Number(settings.shipping_fee||79)
  const shipping = shippingMethod === 'none' ? 0 : shippingMethod === 'inhouse' ? inhouseShipping : (courier?.rate ?? 0)
  const coupon=coupons[couponCode]
  const discount=coupon && subtotal>=coupon.minCart ? Math.min(subtotal,coupon.type==='percent'?Math.round(subtotal*coupon.value)/100:coupon.value):0
  const total = subtotal - discount + shipping

  const setField = e => { const {name,value}=e.target; setForm(prev => ({ ...prev, [name]: value })); setFieldErrors(prev => ({...prev,[name]:undefined})) }
  const message = name => fieldErrors[name] && <small className="field-error" role="alert" id={`${name}-error`}>{fieldErrors[name]}</small>

  async function checkRates() {
    if(!/^\d{6}$/.test(form.pincode)){setFieldErrors(prev=>({...prev,pincode:'Enter a valid 6-digit PIN code.'}));setRatesError('Enter your delivery PIN code in step 1 first.');return}
    setRatesBusy(true);setRatesError('')
    try { const key=ratesKey; const data=await apiRequest('/api/shipping/rates',{pincode:form.pincode,payment,items:cart.map(i=>({variantId:i.variant.id,qty:i.qty}))}); setRates({key,couriers:data.couriers}); setCourierId(data.couriers[0]?.id||''); if(!data.couriers.length)setRatesError('No couriers deliver to this PIN code. Try another shipping method.') }
    catch(error){setRatesError(error.message)}finally{setRatesBusy(false)}
  }

  async function submit(e) {
    e.preventDefault(); if(!cart.length||busy)return
    const errors=validateDelivery(form); setFieldErrors(errors)
    if(Object.keys(errors).length){setError('Please correct the highlighted delivery fields.');return}
    if(shippingMethod==='shiprocket'&&!courier){setError(rates.couriers.length&&!ratesFresh?'Your PIN code, cart or payment method changed. Check shipping rates again.':'Check shipping rates and choose a courier.');return}
    setBusy(true);setError('')
    try { if(payment==='razorpay'&&!window.Razorpay)throw new Error('Razorpay checkout could not be loaded. Please refresh and try again.'); const order=await apiRequest('/api/orders',{customer:form,payment,shippingMethod,courierId:courier?.id,shippingQuote:courier?.rate,items:cart.map(i=>({variantId:i.variant.id,qty:i.qty})),couponCode}); if(payment==='razorpay'){let failure='';await new Promise((resolve,reject)=>{const checkout=new window.Razorpay({key:order.razorpay.keyId,order_id:order.razorpay.orderId,amount:order.razorpay.amount,currency:order.razorpay.currency,name:order.razorpay.name,description:order.razorpay.description,prefill:{name:form.name,email:form.email,contact:form.mobile},theme:{color:'#55723f'},handler:async response=>{try{await apiRequest('/api/payments/razorpay/verify',{orderNumber:order.id,...response});resolve()}catch(e){reject(e)}},modal:{ondismiss:()=>{apiRequest('/api/payments/razorpay/cancel',{orderNumber:order.id,razorpay_order_id:order.razorpay.orderId}).then(()=>refresh()).catch(()=>{});reject(new Error(`${failure||'Payment was cancelled.'} Your order has not been placed and you have not been charged.`))}}});checkout.on('payment.failed',r=>{failure=r.error?.description||'Payment failed.'});checkout.open()})} trackCommerce('Purchase',{value:Number(order.total),currency:'INR',content_ids:order.items.map(i=>String(i.product.id)),content_type:'product',num_items:order.items.reduce((n,i)=>n+i.qty,0)}); clearCart(); navigate('/order-confirmation',{state:{order:{...order,payment_status:payment==='razorpay'?'Paid':'Unpaid'}}}); refresh().catch(()=>{}) }
    catch(error){setError(error.message)}finally{setBusy(false)}
  }

  if (!cart.length) return <main className="section page-top"><div className="empty-state"><h1>Your cart is empty</h1><p>Add products before continuing to checkout.</p><button className="btn btn-primary" onClick={() => navigate('/shop')}>Continue Shopping</button></div></main>

  return (
    <main className="section page-top guest-checkout">
      <div className="page-title"><span className="eyebrow">GUEST CHECKOUT</span><h1>Complete your order</h1><p>No account needed. Enter your delivery details, pick a shipping method and choose how you would like to pay.</p></div>
      <div className="checkout-steps"><span className="active">1 <b>Delivery</b></span><i></i><span className="active">2 <b>Shipping</b></span><i></i><span className="active">3 <b>Review & Pay</b></span><i></i><span>4 <b>Confirmation</b></span></div>
      <form className="checkout-grid" onSubmit={submit} noValidate>
        <div className="checkout-stack">
          <section className="checkout-card">
            <div className="checkout-heading"><MapPin/><div><span className="eyebrow">STEP 1</span><h3>Delivery details</h3></div></div>
            <div className="form-grid guest-form">
              <label>Full name<input name="name" value={form.name} onChange={setField} required placeholder="Your full name"/>{message("name")}</label>
              <label>Mobile number<input name="mobile" value={form.mobile} onChange={setField} required inputMode="numeric" pattern="[0-9]{10}" placeholder="10-digit mobile number"/>{message("mobile")}</label>
              <label className="span-2">Email <small>(for order updates)</small><input name="email" value={form.email} onChange={setField} type="email" placeholder="you@example.com"/>{message("email")}</label>
              <label>PIN code<input name="pincode" value={form.pincode} onChange={setField} required inputMode="numeric" pattern="[0-9]{6}" placeholder="6-digit PIN code"/>{message("pincode")}</label>
              <label>City<input name="city" value={form.city} onChange={setField} required placeholder="City"/>{message("city")}</label>
              <label className="span-2">House / Flat / Street<input name="address" value={form.address} onChange={setField} required placeholder="Complete delivery address"/>{message("address")}</label>
              <label>Landmark <small>(optional)</small><input name="landmark" value={form.landmark} onChange={setField} placeholder="Nearby landmark"/>{message("landmark")}</label>
              <label>State<input name="state" value={form.state} onChange={setField} required placeholder="State"/>{message("state")}</label>
            </div>
          </section>

          <section className="checkout-card">
            <div className="checkout-heading"><Package/><div><span className="eyebrow">STEP 2</span><h3>Shipping Method</h3></div></div>
            <div className="payment-options">
              {methods.includes('shiprocket')&&<label className={shippingMethod === 'shiprocket' ? 'selected' : ''}><input type="radio" name="shippingMethod" value="shiprocket" checked={shippingMethod==='shiprocket'} onChange={e=>setShippingMethod(e.target.value)}/><Truck/><span><strong>Shiprocket — Sandbox rates</strong><small>Sandbox estimates · no booking</small></span></label>}
              {methods.includes('none')&&<label className={shippingMethod === 'none' ? 'selected' : ''}><input type="radio" name="shippingMethod" value="none" checked={shippingMethod==='none'} onChange={e=>setShippingMethod(e.target.value)}/><PackageCheck/><span><strong>No Shipping Required</strong></span></label>}
              {methods.includes('inhouse')&&<label className={shippingMethod === 'inhouse' ? 'selected' : ''}><input type="radio" name="shippingMethod" value="inhouse" checked={shippingMethod==='inhouse'} onChange={e=>setShippingMethod(e.target.value)}/><Home/><span><strong>In-house Shipping</strong><small>Rate set by admin</small></span></label>}
            </div>
            {shippingMethod==='shiprocket'&&<div className="shipping-rates">
              <div className="secure-note"><ShieldCheck size={20}/><span>Check sandbox courier amounts using your delivery pincode and product weight. Final charges may change with packed dimensions and weight. This only retrieves estimates; it does not book a shipment.</span></div>
              <button type="button" className="btn btn-outline" onClick={checkRates} disabled={ratesBusy}>{ratesBusy?'Checking rates…':'Check shipping rates'}</button>
              <small className="shipping-hint">Enter your pincode, then check shipping rates. Check again after changing quantity or pincode.</small>
              {ratesError&&<p role="alert" className="error">{ratesError}</p>}
              {rates.couriers.length>0&&!ratesFresh&&<p role="status" className="error">Your PIN code, cart or payment method changed. Check shipping rates again.</p>}
              {ratesFresh&&rates.couriers.length>0&&<div className="payment-options">{rates.couriers.map(c=><label key={c.id} className={courierId===c.id?'selected':''}><input type="radio" name="courier" value={c.id} checked={courierId===c.id} onChange={e=>setCourierId(e.target.value)}/><span><strong>{c.name} · ₹{c.rate}</strong>{(c.etd||c.days)&&<small>{c.etd?`Estimated delivery ${c.etd}`:`${c.days} days`}</small>}</span></label>)}</div>}
            </div>}
          </section>

          <section className="checkout-card">
            <div className="checkout-heading"><CreditCard/><div><span className="eyebrow">STEP 3</span><h3>Payment method</h3></div></div>
            <div className="payment-options">
              <label className={payment === 'razorpay' ? 'selected' : ''}><input type="radio" name="payment" value="razorpay" checked={payment==='razorpay'} onChange={e=>setPayment(e.target.value)}/><Smartphone/><span><strong>Pay Online</strong><small>UPI, cards, net banking & wallets via Razorpay</small></span></label>
              <label className={payment === 'cod' ? 'selected' : ''}><input type="radio" name="payment" value="cod" checked={payment==='cod'} onChange={e=>setPayment(e.target.value)}/><Truck/><span><strong>Cash on Delivery</strong><small>Pay when your order arrives</small></span></label>
            </div>
            <div className="secure-note"><ShieldCheck size={20}/><span>Online payments are securely processed by Razorpay. Cash on Delivery remains available.</span></div>
          </section>
        </div>

        <aside className="summary-card checkout-summary">
          <h3>Final Review</h3>
          <div className="review-products">{cart.map(i => <div className="review-product" key={`${i.product.id}-${i.variant.weight}`}><img src={i.product.images[0]} alt=""/><div><strong>{i.product.name}</strong><span>{i.variant.weight} · Qty {i.qty}</span></div><b>₹{i.variant.price*i.qty}</b></div>)}</div>
          <div className="summary-line"><span>Subtotal</span><strong>₹{subtotal}</strong></div>
          <div className="summary-line"><span>Shipping</span><strong>{shippingMethod==='shiprocket'&&!courier ? 'Check rates' : shipping ? `₹${shipping}` : shippingMethod==='none' ? 'Not required' : 'Free'}</strong></div>
          {discount>0&&<div className="summary-line"><span>Discount</span><strong>− ₹{discount}</strong></div>}
          <div className="summary-line total"><span>Total</span><strong>₹{total}</strong></div>
          {error&&<p role="alert" className="error">{error}</p>}
          <button disabled={busy} className="btn btn-primary full" type="submit">{busy ? 'Placing order…' : (payment === 'cod' ? 'Place Order' : `Pay ₹${total}`)}</button>
          <small>By placing your order, you agree to the shipping and food-product policies.</small>
        </aside>
      </form>
    </main>
  )
}
