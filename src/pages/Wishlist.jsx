import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { useStore } from '../data/StoreContext'

export default function Wishlist({ wishlist, ...props }) {
  const { products, categories, content_sections, banners, settings, reviews, navigation } =
    useStore()
  const list = products.filter((p) => wishlist.includes(p.id))
  return (
    <main className="section page-top">
      <div className="page-title">
        <span className="eyebrow">SAVED FOR LATER</span>
        <h1>Wishlist</h1>
        <p>Your favourite finds, kept in one place.</p>
      </div>
      {list.length ? (
        <div className="product-grid">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} {...props} isWishlisted />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>A little room for favourites.</h2>
          <p>Save the products you love and come back to them anytime.</p>
          <Link className="btn btn-outline" to="/shop">
            Explore the collection
          </Link>
        </div>
      )}
    </main>
  )
}
