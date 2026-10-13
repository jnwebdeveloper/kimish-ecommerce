import { useState } from 'react'
import { useStore, apiRequest } from '../data/StoreContext'
import { Link, useParams } from 'react-router-dom'

export function Offers() {
 const {coupons}=useStore()
 return <main className="section page-top"><div className="page-title"><span className="eyebrow">PROMOTIONS</span><h1>Current Offers</h1><p>A little extra goodness with your next order.</p></div><div className="offer-grid">{Object.entries(coupons).map(([code,c])=><article className="promo-card" key={code}><h3>{c.label}</h3><p>Minimum order ₹{c.minCart}</p><code className="offer-code">{code}</code><Link className="kimish-text-link" to="/shop">Explore the collection →</Link></article>)}</div></main>
}

export function TrackOrder() {
 const [orderId,setOrderId]=useState(''),[mobile,setMobile]=useState(''),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function submit(e){e.preventDefault();setError('');setResult(null);setBusy(true);try{setResult(await apiRequest('/api/track',{orderId,mobile}))}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <main className="section page-top"><div className="page-title"><span className="eyebrow">DELIVERY STATUS</span><h1>Track your order</h1><p>Your Kimish favourites, on their way to you.</p></div><form className="checkout-card narrow" onSubmit={submit}><div className="tracking-fields"><label>Order ID<input value={orderId} onChange={e=>setOrderId(e.target.value)} required/></label><label>Mobile number<input value={mobile} onChange={e=>setMobile(e.target.value)} type="tel" pattern="[0-9]{10}" required/></label></div><button disabled={busy} className="btn btn-primary">Track order</button>{error&&<p className="error" role="alert">{error}</p>}{result&&<div role="status"><h3>{result.status}</h3><p>{result.order_number}</p>{result.tracking_number&&<p>Tracking reference: {result.tracking_number}</p>}</div>}</form></main>
}

export function Policy() {
 const {pages}=useStore(),{slug}=useParams();const page=pages.find(p=>p.slug===(slug||'policy'))
 return <main className="section page-top policy-page"><div className="page-title"><span className="eyebrow">CUSTOMER CARE</span><h1>{page?.title||'Page not found'}</h1></div>{page&&<div className="policy-content" style={{whiteSpace:'pre-wrap'}}>{page.content}</div>}</main>
}
