import { useState } from 'react'
import './ProductCard.css'
import StoreImage from './StoreImage'
import { Heart, ShoppingCart, Star } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export default function ProductCard({ product, addToCart, toggleWishlist, isWishlisted }) {
  const navigate = useNavigate()
  const [selectedWeight, setSelectedWeight] = useState(null)
  const variant = product.variants.find((v) => v.weight === selectedWeight) || product.variants[0]
  const discount =
    variant.mrp > variant.price ? Math.round((1 - variant.price / variant.mrp) * 100) : 0
  return (
    <article className="product-card refined-product-card">
      <div className="product-image-wrap">
        <div className="card-labels">
          {discount > 0 && <span className="card-saving">{discount}% OFF</span>}
          {product.isNew && <span className="card-new">NEW</span>}
        </div>
        <button
          className={`wish-btn ${isWishlisted ? 'active' : ''}`}
          onClick={() => toggleWishlist(product.id)}
          aria-label={`${isWishlisted ? 'Remove' : 'Save'} ${product.name} ${isWishlisted ? 'from' : 'to'} wishlist`}
          aria-pressed={isWishlisted}
        >
          <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
        <Link to={`/product/${product.slug}`}>
          <StoreImage src={product.images[0]} alt={`${product.name} ${variant.weight}`} />
        </Link>
      </div>
      <div className="product-info">
        <div className="card-meta">
          <span className="card-category">{product.category}</span>
          {Number(product.reviews) > 0 && (
            <span className="rating">
              <Star size={13} fill="currentColor" /> {product.rating}{' '}
              <span>({product.reviews})</span>
            </span>
          )}
        </div>
        <Link className="product-name" to={`/product/${product.slug}`}>
          {product.name}
        </Link>
        <div
          className="card-pack-options"
          role="group"
          aria-label={`Choose pack size for ${product.name}`}
        >
          {product.variants.map((v) => (
            <button
              key={v.id || v.weight}
              className={v.weight === variant.weight ? 'selected' : ''}
              aria-pressed={v.weight === variant.weight}
              onClick={() => setSelectedWeight(v.weight)}
            >
              {v.weight}
            </button>
          ))}
        </div>
        <div className="card-purchase-row">
          <div className="price-row">
            <strong>₹{variant.price}</strong>
            {discount > 0 && <del>₹{variant.mrp}</del>}
          </div>
          <button
            className="product-add card-cart-button"
            aria-label={
              variant.stock < 1
                ? `${product.name} ${variant.weight} is out of stock`
                : `Add ${product.name} ${variant.weight} to cart`
            }
            title={variant.stock < 1 ? 'Out of stock' : 'Add to cart'}
            disabled={variant.stock < 1}
            onClick={() => {
              addToCart(product, variant)
              navigate('/cart')
            }}
          >
            <ShoppingCart size={21} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        {variant.stock < 1 && <span className="card-stock-status">Out of stock</span>}
      </div>
    </article>
  )
}
