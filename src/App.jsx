import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Account from './pages/Account'
import { useStore } from './data/StoreContext'
import { useAuth } from './auth/AuthContext'
import Header from './components/Header'
import Footer from './components/Footer'
import Seo from './components/Seo'
import Home from './pages/Home'
import Shop from './pages/Shop'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderConfirmation from './pages/OrderConfirmation'
import Wishlist from './pages/Wishlist'
import CustomisedGifts, { GiftDetail } from './pages/CustomisedGifts'
import { Offers, Policy, TrackOrder } from './pages/StaticPages'

export default function App() {
  const { user } = useAuth()
  const { products } = useStore()
  const safeRead = (key) => {
    try {
      const value = localStorage.getItem(key)
      return value ? JSON.parse(value) : []
    } catch (error) {
      console.warn(`Could not read ${key} from localStorage`, error)
      return []
    }
  }

  const [cart, setCart] = useState(() => safeRead('kimish-cart'))
  const [wishlist, setWishlist] = useState(() => safeRead('kimish-wishlist'))
  const [query, setQuery] = useState('')
  const location = useLocation()

  useEffect(() => {
    setCart(previous => previous.flatMap(item => {
      const product = products.find(p => p.id === item.product.id || p.slug === item.product.slug)
      const variant = product?.variants.find(v => v.weight === item.variant.weight)
      return variant ? [{ ...item, product, variant }] : []
    }))
  }, [products])

  useEffect(() => {
    try { localStorage.setItem('kimish-cart', JSON.stringify(cart)) } catch (error) { console.warn('Could not save cart', error) }
  }, [cart])

  useEffect(() => {
    try { localStorage.setItem('kimish-wishlist', JSON.stringify(wishlist)) } catch (error) { console.warn('Could not save wishlist', error) }
  }, [wishlist])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  function addToCart(product, variant) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id && i.variant.weight === variant.weight)
      if (idx >= 0) return prev.map((i,n) => n === idx ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product, variant, qty: 1 }]
    })
    if (window.fbq) window.fbq('track', 'AddToCart', { content_ids: [String(product.id)], content_name: product.name, content_type: 'product', value: Number(variant.price), currency: 'INR' })
  }

  function updateQty(item, qty) {
    setCart(prev => prev.map(i =>
      i.product.id === item.product.id && i.variant.weight === item.variant.weight ? { ...i, qty } : i
    ))
  }

  function removeFromCart(item) {
    setCart(prev => prev.filter(i => !(i.product.id === item.product.id && i.variant.weight === item.variant.weight)))
  }

  function toggleWishlist(id) {
    setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const cartCount = useMemo(() => cart.reduce((s,i) => s + i.qty, 0), [cart])

  const shared = { addToCart, toggleWishlist, wishlist }

  return (
    <div className="app">
      <Seo />
      <Header user={user} {...shared} cartCount={cartCount} wishlistCount={wishlist.length} query={query} setQuery={setQuery}/>
      <Routes>
        <Route path="/" element={<Home {...shared} />} />
        <Route path="/shop" element={<Shop query={query} {...shared} />} />
        <Route path="/customised-gifts" element={<CustomisedGifts />} />
        <Route path="/customised-gifts/:slug" element={<GiftDetail />} />
        <Route path="/product/:slug" element={<ProductDetail {...shared} />} />
        <Route path="/account" element={<Account />} />
        <Route path="/login" element={<Account />} />
        <Route path="/wishlist" element={<Wishlist {...shared} />} />
        <Route path="/cart" element={<Cart cart={cart} updateQty={updateQty} removeFromCart={removeFromCart} />} />
        <Route path="/checkout" element={<Checkout cart={cart} clearCart={() => setCart([])} />} />
        <Route path="/order-confirmation" element={<OrderConfirmation />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/track-order" element={<TrackOrder />} />
        <Route path="/pages/:slug" element={<Policy />} />
        <Route path="/policy" element={<Policy />} />
      </Routes>
      <Footer />
    </div>
  )
}
