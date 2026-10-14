import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { useStore } from '../data/StoreContext'

export default function Shop({ query, ...props }) {
  const { products } = useStore()
  const [params, setParams] = useSearchParams()
  const [category, setCategory] = useState(params.get('category') || 'All')
  const [sort, setSort] = useState(params.get('sort') || 'featured')
  const [weight, setWeight] = useState('All')
  const [maxPrice, setMaxPrice] = useState(2000)

  useEffect(() => {
    setCategory(params.get('category') || 'All')
    setSort(params.get('sort') || 'featured')
  }, [params])

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const groups = {
        Nuts: ['Cashew', 'Almonds', 'Walnut'],
        'Roasted Items': ['Pista'],
        Seeds: ['Seeds'],
        'Dried Fruits': ['Raisins', 'Cranberries'],
        'Everyday Favourite': ['Makhana'],
      }
      const categoryMatch =
        category === 'All' ||
        (groups[category] ? groups[category].includes(p.category) : p.category === category)
      const q = (query || '').toLowerCase()
      return (
        categoryMatch &&
        (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) &&
        (weight === 'All' || p.variants.some((v) => v.weight === weight)) &&
        Math.min(...p.variants.map((v) => v.price)) <= maxPrice
      )
    })
    if (sort === 'popular') list = [...list].sort((a, b) => b.reviews - a.reviews)
    if (sort === 'price-low')
      list = [...list].sort((a, b) => a.variants[0].price - b.variants[0].price)
    if (sort === 'price-high')
      list = [...list].sort((a, b) => b.variants[0].price - a.variants[0].price)
    if (sort === 'new') list = [...list].sort((a, b) => Number(b.isNew) - Number(a.isNew))
    return list
  }, [products, category, sort, weight, maxPrice, query])

  function updateCategory(value) {
    setCategory(value)
    const next = new URLSearchParams(params)
    value === 'All' ? next.delete('category') : next.set('category', value)
    setParams(next)
  }

  return (
    <main className="section page-top shop-page">
      <div className="page-title">
        <span className="eyebrow">PREMIUM COLLECTION</span>
        <h1>Shop Kimish</h1>
        <p>Explore premium nuts, dry fruits and seeds across pack sizes.</p>
      </div>
      <section className="filters filters-horizontal filter-panel" aria-label="Product filters">
        <div className="filter-heading">
          <span>REFINE YOUR PICKS</span>
          <h3>Find your favourites</h3>
          <p>Filter the collection by category, pack size and price.</p>
        </div>
        <label className="filter-control">
          <span>Category</span>
          <select value={category} onChange={(e) => updateCategory(e.target.value)}>
            <option>All</option>
            {['Nuts', 'Seeds', 'Dried Fruits', 'Everyday Favourite', 'Roasted Items'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="filter-control">
          <span>Pack Size</span>
          <select value={weight} onChange={(e) => setWeight(e.target.value)}>
            {['All', '100g', '200g', '250g', '500g', '1kg'].map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
        <label className="price-filter filter-control">
          <span>
            Maximum price <b>₹{maxPrice}</b>
          </span>
          <input
            type="range"
            min="200"
            max="2000"
            step="100"
            value={maxPrice}
            onChange={(e) => setMaxPrice(+e.target.value)}
          />
          <small>
            ₹200 <em>₹2,000</em>
          </small>
        </label>
      </section>
      <section className="shop-products">
        <div className="shop-toolbar">
          <span>
            <b>{filtered.length}</b> {filtered.length === 1 ? 'product' : 'products'}
          </span>
        </div>
        <div className="product-grid">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              {...props}
              isWishlisted={props.wishlist.includes(p.id)}
            />
          ))}
        </div>
        {!filtered.length && <div className="empty-state">No products match your filters.</div>}
      </section>
      <section className="packing-story" aria-label="How Kimish products are packed">
        <div className="packing-visual">
          <img
            src="/brand-banners/ingredients.png"
            alt="Kimish quality ingredients and careful packing"
          />
        </div>
        <div className="packing-copy">
          <span className="eyebrow">FROM SELECTION TO SEAL</span>
          <h2>Packed with care. Sealed for freshness.</h2>
          <p>
            Every Kimish pack follows a considered handling journey designed to protect quality,
            texture and freshness until it reaches your shelf.
          </p>
          <div className="pack-steps">
            <div className="pack-step">
              <b>01 · Carefully selected</b>
              <span>Quality ingredients chosen for every batch.</span>
            </div>
            <div className="pack-step">
              <b>02 · Quality checked</b>
              <span>Visual and handling checks before packing.</span>
            </div>
            <div className="pack-step">
              <b>03 · Hygienically packed</b>
              <span>Handled with care through the packing process.</span>
            </div>
            <div className="pack-step">
              <b>04 · Freshness sealed</b>
              <span>Secure packs prepared for dispatch to you.</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
