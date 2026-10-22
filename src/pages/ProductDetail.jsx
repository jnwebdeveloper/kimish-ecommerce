import './ProductDetail.css'
import StoreImage from '../components/StoreImage'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../data/StoreContext'
import ProductCard from '../components/ProductCard'
import { Heart, ShieldCheck, Star, Truck } from 'lucide-react'

export default function ProductDetail({ addToCart, toggleWishlist, wishlist }) {
  const { products } = useStore()
  const { slug } = useParams()
  const navigate = useNavigate()
  const product = products.find((p) => p.slug === slug)
  const [variantIndex, setVariantIndex] = useState(0)
  const [imageIndex, setImageIndex] = useState(0)

  const related = useMemo(() => {
    if (!product) return []
    const sameCategory = products.filter(
      (p) => p.category === product.category && p.id !== product.id,
    )
    const complementary = products.filter(
      (p) => p.category !== product.category && p.id !== product.id,
    )
    return [...sameCategory, ...complementary].slice(0, 4)
  }, [product, products])

  if (!product)
    return (
      <main className="section page-top">
        <h1>Product not found</h1>
      </main>
    )

  const variant = product.variants[variantIndex] || product.variants[0]
  const discount = Math.round((1 - variant.price / variant.mrp) * 100)
  const aboutItems = (product.about_item || '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)

  return (
    <main className="section page-top product-detail-page">
      <div className="product-detail">
        <div className="detail-gallery">
          <div className="thumbs thumbs-vertical">
            {product.images.map((img, i) => (
              <button
                className={i === imageIndex ? 'active' : ''}
                key={`${img}-${i}`}
                onClick={() => setImageIndex(i)}
              >
                <StoreImage src={img} alt={`${product.name} view ${i + 1}`} />
              </button>
            ))}
          </div>
          <StoreImage
            className="detail-main-image"
            src={
              product.images[imageIndex] ||
              product.images[0] ||
              product.image ||
              '/image-placeholder.svg'
            }
            alt={product.name}
          />
        </div>

        <div className="detail-info">
          <span className="eyebrow">{product.category}</span>
          <h1>{product.name}</h1>
          <div className="rating">
            <Star size={16} fill="currentColor" /> {product.rating}{' '}
            <span>{product.reviews} reviews</span>
          </div>
          <p>{product.description}</p>

          <h4>Select Pack Size</h4>
          <div className="variant-list">
            {product.variants.map((v, i) => (
              <button
                className={i === variantIndex ? 'active' : ''}
                onClick={() => setVariantIndex(i)}
                key={v.weight}
              >
                {v.weight}
              </button>
            ))}
          </div>

          <div className="detail-price">
            <strong>₹{variant.price}</strong>
            <del>₹{variant.mrp}</del>
            <span>{discount}% off</span>
          </div>

          <div className="detail-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                addToCart(product, variant)
                navigate('/cart')
              }}
            >
              Add to Cart
            </button>
            <button className="btn btn-outline" onClick={() => toggleWishlist(product.id)}>
              <Heart size={18} /> {wishlist.includes(product.id) ? 'Saved' : 'Wishlist'}
            </button>
          </div>

          <div className="detail-points">
            <div>
              <Truck size={20} />
              <span>PAN India delivery subject to serviceability</span>
            </div>
            <div>
              <ShieldCheck size={20} />
              <span>Secure checkout and payment integration ready</span>
            </div>
          </div>
        </div>
      </div>

      <section
        className={`product-facts product-information-section${aboutItems.length ? '' : ' without-about'}`}
        aria-label="Product information"
      >
        {aboutItems.length > 0 && (
          <div className="about-item-panel">
            <span className="eyebrow">WHY YOU’LL LOVE IT</span>
            <h2>About this item</h2>
            <ul>
              {aboutItems.map((item, i) => {
                const [lead, ...rest] = item.split(':')
                return (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <p>
                      <strong>
                        {lead}
                        {rest.length ? ':' : ''}
                      </strong>
                      {rest.length ? ' ' + rest.join(':') : ''}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        <div className="product-care-grid">
          <article>
            <span>01</span>
            <h4>Ingredients / Product Information</h4>
            <p>{product.ingredients}</p>
          </article>
          <article>
            <span>02</span>
            <h4>Storage Instructions</h4>
            <p>{product.storage}</p>
          </article>
          <article>
            <span>03</span>
            <h4>No Returns Policy</h4>
            <p>
              Food products are non-returnable. Replacement or refund support is available for
              damaged or incorrect orders, subject to the final business policy.
            </p>
          </article>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section-inner pairing-section">
          <div className="pairing-head">
            <div>
              <span className="eyebrow">CURATED FOR YOUR CART</span>
              <h2>Pairs well with your pick</h2>
            </div>
            <p>A few Kimish favourites selected to complement the product you are viewing.</p>
          </div>
          <div className="pairing-rail">
            <div className="pairing-intro">
              <span>THE KIMISH PAIRING EDIT</span>
              <h3>Build a better snack shelf.</h3>
              <p>Mix textures, flavours and everyday favourites in one thoughtful selection.</p>
            </div>
            {related.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                addToCart={addToCart}
                toggleWishlist={toggleWishlist}
                isWishlisted={wishlist.includes(product.id)}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
