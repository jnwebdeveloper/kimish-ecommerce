import { Heart, Plus, Star } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export default function ProductCard({ product, addToCart, toggleWishlist, isWishlisted }) {
  const navigate = useNavigate()
  const variant = product.variants[0]
  const discount = Math.round((1 - variant.price / variant.mrp) * 100)
  const sizes = product.variants.map((v) => v.weight).join(' | ')
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        {product.isNew && <span className="badge badge-new">NEW</span>}
        <button
          className={`wish-btn ${isWishlisted ? 'active' : ''}`}
          onClick={() => toggleWishlist(product.id)}
          aria-label={`${isWishlisted ? 'Remove' : 'Save'} ${product.name} ${isWishlisted ? 'from' : 'to'} wishlist`}
          aria-pressed={isWishlisted}
        >
          <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
        <Link to={`/product/${product.slug}`}>
          <img src={product.images[0]} alt={`${product.name} ${variant.weight}`} />
        </Link>
      </div>
      <div className="product-info">
        <div className="rating">
          {Number(product.reviews) > 0 ? (
            <>
              <Star size={14} fill="currentColor" /> {product.rating}{' '}
              <span>({product.reviews})</span>
            </>
          ) : (
            <span>No reviews yet</span>
          )}
        </div>
        <Link className="product-name" to={`/product/${product.slug}`}>
          {product.name}
        </Link>
        <div className="pack-sizes">{sizes}</div>
        <div className="price-row">
          <strong>₹{variant.price}</strong>
          <del>₹{variant.mrp}</del>
          <span>{discount}% OFF</span>
        </div>
        <button
          className="product-add"
          disabled={variant.stock < 1}
          onClick={() => {
            addToCart(product, variant)
            navigate('/cart')
          }}
        >
          <Plus size={16} strokeWidth={1.5} /> {variant.stock < 1 ? 'Out of stock' : 'Add to cart'}
        </button>
      </div>
    </article>
  )
}
