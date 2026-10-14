import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Heart,
  ShoppingBag,
  Truck,
  ChevronDown,
  ArrowRight,
  Menu,
  X,
  UserRound,
} from 'lucide-react'
import { useStore } from '../data/StoreContext'

const menus = [
  {
    name: 'Nuts',
    categories: ['Cashew', 'Almonds', 'Walnut'],
    description: 'A little crunch. A lot of goodness.',
  },
  {
    name: 'Seeds',
    categories: ['Seeds'],
    description: 'Small ingredients for better everyday moments.',
  },
  {
    name: 'Dried Fruits',
    categories: ['Raisins', 'Cranberries'],
    description: 'Naturally colourful pantry favourites.',
  },
  {
    name: 'Everyday Favourite',
    categories: ['Makhana'],
    description: 'Thoughtful picks for your daily snack break.',
  },
  {
    name: 'Roasted Items',
    categories: ['Pista'],
    description: 'Roasted favourites with a satisfying crunch.',
  },
  {
    name: 'Customised Gifts',
    categories: [],
    description: 'Beautifully presented gifts for celebrations and thoughtful moments.',
    gifts: [
      { name: 'Heritage Pink Gift Box', image: '/gifts/custom-gift-pink-closed.jpeg' },
      { name: 'Curated Four Jar Gift Box', image: '/gifts/custom-gift-pink-open.jpeg' },
      { name: 'Royal Blue Gift Box', image: '/gifts/custom-gift-blue.jpeg' },
    ],
  },
]
export default function Header({
  cartCount = 0,
  wishlistCount = 0,
  addToCart,
  toggleWishlist,
  wishlist = [],
  user,
}) {
  const { products, categories, content_sections, banners, settings, reviews, navigation } =
    useStore()
  const [openMenu, setOpenMenu] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const headerRef = useRef(null)
  const triggerRefs = useRef({})
  const location = useLocation()
  const selected = new URLSearchParams(location.search).get('category')

  useEffect(() => {
    setOpenMenu(null)
    setMobileOpen(false)
  }, [location.pathname, location.search])
  useEffect(() => {
    const outside = (event) => {
      if (!headerRef.current?.contains(event.target)) {
        setOpenMenu(null)
        setMobileOpen(false)
      }
    }
    const escape = (event) => {
      if (event.key === 'Escape') {
        if (openMenu) {
          triggerRefs.current[openMenu]?.focus()
          setOpenMenu(null)
        } else {
          setMobileOpen(false)
          headerRef.current?.querySelector('.menu-toggle')?.focus()
        }
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [openMenu])

  return (
    <>
      <div className="utility-bar">
        <div>
          <Truck size={14} /> Free shipping across India on orders above ₹
          {settings.free_shipping_threshold || 499}
        </div>
        <div className="utility-links">
          <NavLink to="/track-order">Track Order</NavLink>
          <span>|</span>
          <NavLink to="/policy">Help</NavLink>
        </div>
      </div>
      <header
        className="boutique-header"
        ref={headerRef}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpenMenu(null)
            setMobileOpen(false)
          }
        }}
      >
        <Link className="boutique-brand" to="/" aria-label="Kimish home">
          <img src="/kimish-logo.png" alt="Kimish premium nuts and seeds" />
        </Link>
        <button
          className="menu-toggle"
          aria-expanded={mobileOpen}
          aria-controls="collection-navigation"
          onClick={() => {
            setMobileOpen(!mobileOpen)
            setOpenMenu(null)
          }}
        >
          {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          <span>{mobileOpen ? 'Close' : 'Menu'}</span>
        </button>
        <nav
          id="collection-navigation"
          className={`collection-navigation ${mobileOpen ? 'is-mobile-open' : ''}`}
          aria-label="Primary navigation"
        >
          {menus.map((baseMenu, index) => {
            const dbCategories = categories
              .filter((c) => c.group_name === baseMenu.name && baseMenu.categories.includes(c.name))
              .map((c) => c.name)
            const menu = {
              ...baseMenu,
              categories: dbCategories.length ? dbCategories : baseMenu.categories,
            }
            const expanded = openMenu === menu.name
            const active = selected === menu.name || menu.categories.includes(selected)
            return (
              <div className="collection-nav-item" key={menu.name}>
                <button
                  ref={(node) => {
                    triggerRefs.current[menu.name] = node
                  }}
                  className={`collection-trigger ${active ? 'is-current' : ''}`}
                  aria-expanded={expanded}
                  aria-controls={`collection-panel-${index}`}
                  onClick={() => setOpenMenu(expanded ? null : menu.name)}
                >
                  {menu.name}
                  <ChevronDown size={14} />
                </button>
                <div
                  className="collection-panel luxury-mega"
                  id={`collection-panel-${index}`}
                  hidden={!expanded}
                >
                  <div className="mega-category-list">
                    <span className="mega-kicker">EXPLORE {menu.name.toUpperCase()}</span>
                    <Link
                      className="mega-category-active"
                      to={
                        menu.name === 'Customised Gifts'
                          ? '/customised-gifts'
                          : `/shop?category=${encodeURIComponent(menu.name)}`
                      }
                      onClick={() => setOpenMenu(null)}
                    >
                      All {menu.name}
                    </Link>
                    {menu.categories.map((category) => (
                      <Link
                        key={category}
                        to={`/shop?category=${encodeURIComponent(category)}`}
                        onClick={() => setOpenMenu(null)}
                      >
                        {category}
                      </Link>
                    ))}
                  </div>
                  <div className="mega-story">
                    <span className="mega-kicker">KIMISH {menu.name.toUpperCase()}</span>
                    <h2>
                      {menu.name === 'Customised Gifts'
                        ? 'Thoughtfully Curated. Beautifully Personalised.'
                        : 'Good ingredients. Handled thoughtfully.'}
                    </h2>
                    <p>{menu.description}</p>
                    <Link
                      className="mega-cta"
                      to={
                        menu.name === 'Customised Gifts'
                          ? '/customised-gifts'
                          : `/shop?category=${encodeURIComponent(menu.name)}`
                      }
                      onClick={() => setOpenMenu(null)}
                    >
                      EXPLORE {menu.name.toUpperCase()} <ArrowRight size={16} />
                    </Link>
                    <div className="mega-trust">
                      <span>Premium quality</span>
                      <span>Hygienically packed</span>
                      <span>Pan India delivery</span>
                    </div>
                  </div>
                  <div className="mega-showcase">
                    <div className="mega-showcase-head">
                      <span className="mega-kicker">
                        {menu.name === 'Customised Gifts'
                          ? 'OUR SIGNATURE GIFT BOXES'
                          : `OUR ${menu.name.toUpperCase()} PICKS`}
                      </span>
                      <Link
                        to={
                          menu.name === 'Customised Gifts'
                            ? '/customised-gifts'
                            : `/shop?category=${encodeURIComponent(menu.name)}`
                        }
                        onClick={() => setOpenMenu(null)}
                      >
                        VIEW ALL <ArrowRight size={14} />
                      </Link>
                    </div>
                    <div className="mega-showcase-grid">
                      {(
                        menu.gifts ||
                        products.filter((product) => menu.categories.includes(product.category))
                      )
                        .slice(0, 3)
                        .map((item) => {
                          const isGift = Boolean(menu.gifts)
                          const href = isGift ? '/customised-gifts' : `/product/${item.slug}`
                          const image = isGift ? item.image : item.images?.[0]
                          return (
                            <Link
                              className="mega-showcase-card"
                              key={item.id || item.name}
                              to={href}
                              onClick={() => {
                                setOpenMenu(null)
                                setMobileOpen(false)
                              }}
                            >
                              <span>
                                <img src={image} alt={item.name} />
                              </span>
                              <strong>{item.name}</strong>
                            </Link>
                          )
                        })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {navigation
            .filter((n) => n.location === 'header')
            .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
            .map((n) => (
              <Link
                className="managed-nav-link"
                key={n.id}
                to={n.url}
                target={n.open_new_tab ? '_blank' : undefined}
                rel={n.open_new_tab ? 'noopener noreferrer' : undefined}
              >
                {n.label}
              </Link>
            ))}
          <Link className="collection-shop-all" to="/shop">
            Shop all <ArrowRight size={15} />
          </Link>
        </nav>
        <nav className="boutique-actions" aria-label="Account actions">
          <NavLink to="/account" aria-label={user ? 'My account' : 'Log in'}>
            <UserRound size={21} strokeWidth={1.5} />
            <b>{user ? 'Account' : 'Log in'}</b>
          </NavLink>
          <NavLink
            to="/wishlist"
            aria-label={`Wishlist${wishlistCount ? `, ${wishlistCount} items` : ''}`}
          >
            <Heart size={21} strokeWidth={1.5} />
            <b>Wishlist</b>
            {wishlistCount > 0 && <span>{wishlistCount}</span>}
          </NavLink>
          <NavLink to="/cart" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}>
            <ShoppingBag size={21} strokeWidth={1.5} />
            <b>Cart</b>
            {cartCount > 0 && <span>{cartCount}</span>}
          </NavLink>
        </nav>
      </header>
    </>
  )
}
