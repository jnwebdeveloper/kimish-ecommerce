import { SlidersHorizontal, RotateCcw, ChevronDown, X } from 'lucide-react'
import './ShopFilters.css'
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

  const priceLabel = (value) => `₹${value.toLocaleString('en-IN')}`
  function resetFilters() {
    setWeight('All')
    setMaxPrice(2000)
    updateCategory('All')
  }
  function updateSort(value) {
    setSort(value)
    const next = new URLSearchParams(params)
    value === 'featured' ? next.delete('sort') : next.set('sort', value)
    setParams(next)
  }

  return (
    <main className="section page-top shop-page">
      <div className="page-title">
        <span className="eyebrow">PREMIUM COLLECTION</span>
        <h1>Shop Kimish</h1>
        <p>Explore premium nuts, dry fruits and seeds across pack sizes.</p>
      </div>
      <section className="collection-filters" aria-label="Product filters">
        <div className="collection-filter-header">
          <div className="collection-filter-intro">
            <span className="collection-filter-icon" aria-hidden="true">
              <SlidersHorizontal size={24} strokeWidth={1.6} />
            </span>
            <div>
              <h2>Find your favourites</h2>
              <p>Discover the right fit for your pantry.</p>
            </div>
          </div>
          <button
            type="button"
            className="collection-reset"
            onClick={resetFilters}
            disabled={category === 'All' && weight === 'All' && maxPrice === 2000}
          >
            <RotateCcw size={16} aria-hidden="true" /> Reset filters
          </button>
        </div>
        <div className="collection-filter-grid">
          <label className="collection-control">
            <span>Category</span>
            <span className="collection-select">
              <select value={category} onChange={(e) => updateCategory(e.target.value)}>
                <option value="All">All categories</option>
                {['Nuts', 'Seeds', 'Dried Fruits', 'Everyday Favourite', 'Roasted Items'].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  ),
                )}
                {![
                  'All',
                  'Nuts',
                  'Seeds',
                  'Dried Fruits',
                  'Everyday Favourite',
                  'Roasted Items',
                ].includes(category) && <option value={category}>{category}</option>}
              </select>
              <ChevronDown size={18} aria-hidden="true" />
            </span>
          </label>
          <label className="collection-control">
            <span>Pack size</span>
            <span className="collection-select">
              <select value={weight} onChange={(e) => setWeight(e.target.value)}>
                <option value="All">All sizes</option>
                {['100g', '200g', '250g', '500g', '1kg'].map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
              <ChevronDown size={18} aria-hidden="true" />
            </span>
          </label>
          <div className="collection-control collection-price">
            <div className="collection-price-label">
              <label htmlFor="collection-price">Price range</label>
              <output htmlFor="collection-price">
                Up to <b>{priceLabel(maxPrice)}</b>
              </output>
            </div>
            <input
              id="collection-price"
              aria-label="Maximum price"
              aria-valuetext={priceLabel(maxPrice)}
              type="range"
              min="200"
              max="2000"
              step="100"
              value={maxPrice}
              style={{ '--range-progress': `${((maxPrice - 200) / 1800) * 100}%` }}
              onChange={(e) => setMaxPrice(+e.target.value)}
            />
            <div className="collection-price-limits" aria-hidden="true">
              <span>₹200</span>
              <span>₹2,000</span>
            </div>
          </div>
        </div>
      </section>
      <section className="shop-products">
        <div className="collection-toolbar">
          <div className="collection-results">
            <span className="collection-count" aria-live="polite">
              <b>{filtered.length}</b> {filtered.length === 1 ? 'product' : 'products'}
            </span>
            {category !== 'All' && (
              <button
                type="button"
                className="collection-chip"
                aria-label={`Remove category filter ${category}`}
                onClick={() => updateCategory('All')}
              >
                {category}
                <X size={14} aria-hidden="true" />
              </button>
            )}
            {weight !== 'All' && (
              <button
                type="button"
                className="collection-chip"
                aria-label={`Remove pack size filter ${weight}`}
                onClick={() => setWeight('All')}
              >
                {weight}
                <X size={14} aria-hidden="true" />
              </button>
            )}
            {maxPrice < 2000 && (
              <button
                type="button"
                className="collection-chip"
                aria-label="Remove price filter"
                onClick={() => setMaxPrice(2000)}
              >
                Up to {priceLabel(maxPrice)}
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <label className="collection-sort">
            <span>Sort by:</span>
            <span className="collection-select">
              <select
                aria-label="Sort products"
                value={sort}
                onChange={(e) => updateSort(e.target.value)}
              >
                <option value="featured">Recommended</option>
                <option value="popular">Most popular</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="new">Newest arrivals</option>
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </label>
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
