import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, CreditCard, Headphones, Leaf, PackageCheck, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import { useStore } from '../data/StoreContext'
import '../home-editorial.css'

export default function Home(props) {
  const { products, categories, content_sections, banners, settings, reviews, navigation } = useStore() 
  const content = Object.fromEntries(content_sections.map(section=>[section.key,section]))
  const seasonal = banners.find(b=>b.placement==='seasonal')
  const bottom = banners.find(b=>b.placement==='bottom')
  const heroBanner = banners.find(b=>b.placement==='hero')

const photo = name => products.find(p => p.category === name)?.images[0]
const menuCategories = categories.map(c => ({name:c.name,image:c.image,query:c.group_name}))

  const bestsellers = products.filter(p => p.bestseller).slice(0, 4)
  const favourites = products.filter(p => p.featured).slice(0, 3)
  const arrivals = [...products].sort((a,b)=>Number(b.isNew)-Number(a.isNew)).slice(0,4)
  const almond = photo('Almonds'), cashew = photo('Cashew'), makhana = photo('Makhana'), cranberry = photo('Cranberries')

  return <main className="editorial-home">
    <section className="gift-hero">
      <div className="gift-hero-copy">
        <span className="hero-kicker-light">CUSTOMISED GIFTS, CURATED FOR YOU</span>
        <h1>Thoughtfully gifted. Beautifully remembered.</h1>
        <p>Celebrate festivals, weddings, corporate milestones and special moments with premium Kimish gift boxes, curated with care and made to feel personal.</p>
        <div className="hero-actions-refined"><Link className="button button-light" to="/customised-gifts">Explore gift boxes <ArrowRight size={17}/></Link><Link className="button button-ghost-light" to="/shop">Shop collections</Link></div>
      </div>
      <div className="gift-hero-gallery">
        <img className="gift-hero-main" src="/gifts/custom-gift-pink-open.jpeg" alt="Kimish customised pink gift box with four jars"/>
        <img className="gift-hero-side" src="/gifts/custom-gift-blue.jpeg" alt="Kimish royal blue customised gift box"/>
        <div className="gift-hero-note"><span>CURATED FOR EVERY OCCASION</span><strong>Premium gifting, made personal.</strong></div>
      </div>
      <div className="hero-proof"><span>Premium ingredients</span><span>Beautifully packed</span><span>Made for celebrations</span></div>
      <svg className="hero-category-curve" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 15 C360 75 1080 75 1440 15 L1440 60 L0 60 Z"/></svg>
    </section>

    <section className="category-ribbon refined-categories">
      <div className="category-title"><span>SHOP BY</span><strong>Category</strong></div>
      <div className="category-scroll">
        {menuCategories.map(c => <Link key={c.name} to={`/shop?category=${encodeURIComponent(c.query)}`} className="editorial-category">
          <div><img src={c.image} alt={c.name}/></div><span>{c.name}</span>
        </Link>)}
      </div>
    </section>

    <section className="signature-gifts signature-gifts-editorial" aria-labelledby="signature-gifts-title">
      <div className="signature-gifts-intro">
        <span id="signature-gifts-title" className="signature-kicker">OUR SIGNATURE GIFT BOXES</span>
        <h2>Small choices.<br/>Better days.</h2>
        <p>Thoughtfully curated gift boxes for weddings, celebrations, corporate gifting and every special moment.</p>
        <Link className="signature-explore" to="/customised-gifts">Explore gift boxes <ArrowRight size={17}/></Link>
        <span className="signature-botanical" aria-hidden="true">⌇</span>
      </div>
      <div className="signature-gifts-showcase">
        <div className="signature-gifts-topline"><Link className="signature-view-all" to="/customised-gifts">View all <ArrowRight size={17}/></Link></div>
        <div className="signature-gifts-grid">
          <Link className="signature-gift-card" to="/customised-gifts">
            <div className="signature-gift-image"><span className="signature-card-note">A timeless<br/>gesture</span><img src="/gifts/custom-gift-pink-closed.jpeg" alt="Heritage Pink Gift Box" loading="lazy"/></div>
            <div className="signature-card-footer"><h3>Heritage Pink Gift Box</h3><span className="signature-arrow"><ArrowRight size={18}/></span></div>
          </Link>
          <Link className="signature-gift-card" to="/customised-gifts">
            <div className="signature-gift-image"><span className="signature-card-note">Curated<br/>with care</span><img src="/gifts/custom-gift-pink-open.jpeg" alt="Curated Four Jar Gift Box" loading="lazy"/></div>
            <div className="signature-card-footer"><h3>Curated Four Jar Gift Box</h3><span className="signature-arrow"><ArrowRight size={18}/></span></div>
          </Link>
          <Link className="signature-gift-card" to="/customised-gifts">
            <div className="signature-gift-image"><span className="signature-card-note">For life’s<br/>special moments</span><img src="/gifts/custom-gift-blue.jpeg" alt="Royal Blue Gift Box" loading="lazy"/></div>
            <div className="signature-card-footer"><h3>Royal Blue Gift Box</h3><span className="signature-arrow"><ArrowRight size={18}/></span></div>
          </Link>
        </div>
      </div>
    </section>

    <section className="home-section editorial-products">
      <div className="editorial-heading"><div><span>THE KIMISH EDIT</span><h2>Most loved, for good reason.</h2></div><Link className="text-action" to="/shop?sort=popular">Shop all <ArrowRight size={17}/></Link></div>
      <div className="product-grid">{bestsellers.map(p => <ProductCard key={p.id} product={p} {...props} isWishlisted={props.wishlist.includes(p.id)} />)}</div>
    </section>

    {(content.everyday) && <section className="concept-section">
      <div className="concept-copy">
        <span>{content.everyday?.subtitle}</span><h2>{content.everyday?.title}</h2>
        <p>{content.everyday?.body}</p>
        <Link to={content.everyday.link || "/shop"} className="button button-gold">{content.everyday?.button_text} <ArrowRight size={17}/></Link>
        <div className="campaign-points"><div><Leaf/>Quality-focused sourcing</div><div><PackageCheck/>Packed for lasting freshness</div><div><ShieldCheck/>Carefully quality checked</div></div>
      </div>
      <div className="concept-visual">
        <div className="concept-card cranberry-card"><img src={cranberry} alt="Kimish cranberries"/></div>
        <div className="concept-card makhana-card"><img src={makhana} alt="Kimish makhana"/></div>
        <div className="floating-note">Premium ingredients.<br/><strong>Beautifully packed.</strong></div>
      </div>
    </section>}



    <section className="home-section editorial-products new-edit">
      <div className="editorial-heading"><div><span>FRESH ON THE SHELF</span><h2>New arrivals.</h2></div><Link className="text-action" to="/shop?sort=new">See what’s new <ArrowRight size={17}/></Link></div>
      <div className="product-grid">{arrivals.map(p => <ProductCard key={p.id} product={p} {...props} isWishlisted={props.wishlist.includes(p.id)} />)}</div>
    </section>

    <div className="kimish-editorial">
      {(content.story) && <section className="kimish-way" aria-labelledby="kimish-way-title">
        <div className="kimish-way-copy">
          <span className="kimish-eyebrow">{content.story?.subtitle}</span>
          <h2 id="kimish-way-title">{content.story?.title}</h2>
          <p>{content.story?.body}</p>
          <Link className="kimish-text-link" to="/shop">{content.story?.button_text} <ArrowRight size={18} aria-hidden="true"/></Link>
        </div>
        <div className="kimish-stories">
          {['story-ingredients','story-care','story-moments'].map(key=>content[key]).filter(Boolean).map(story => <article className="kimish-story" key={story.key}>
            <img src={story.image || almond} alt={story.title} loading="lazy"/>
            <div><h3>{story.title}</h3><p>{story.body}</p></div>
          </article>)}
        </div>
      </section>}

      <div className="kimish-discovery">
        <section className="kimish-favourites" aria-labelledby="kimish-favourites-title">
          <div className="kimish-favourites-heading">
            <h2 id="kimish-favourites-title">Featured Favourites</h2>
            <Link className="kimish-text-link" to="/shop">View all <ArrowRight size={17} aria-hidden="true"/></Link>
          </div>
          <div className="kimish-favourite-grid">
            {favourites.map(product => <ProductCard key={product.id} product={product} {...props} isWishlisted={props.wishlist.includes(product.id)}/>)}
          </div>
        </section>
        {(seasonal) && <section className="kimish-seasonal" aria-labelledby="kimish-seasonal-title">
          <div className="kimish-seasonal-copy">
            <span className="kimish-eyebrow">Seasonal Picks</span>
            <h2 id="kimish-seasonal-title">{seasonal?.title}</h2>
            <p>{seasonal?.subtitle}</p>
            <Link className="button button-light" to={seasonal?.link || "/shop"}>{seasonal?.button_text} <ArrowRight size={17} aria-hidden="true"/></Link>
          </div>
          <div className="kimish-seasonal-image"><img src={seasonal?.image} alt={seasonal?.title} loading="lazy"/></div>
        </section>}
      </div>
    </div>

    {(content.promise) && <section className="quality-promise" aria-labelledby="quality-promise-title">
      <div className="quality-promise-intro">
        <span className="eyebrow">{content.promise?.subtitle}</span>
        <h2 id="quality-promise-title">{content.promise?.title}</h2>
        <p>{content.promise?.body}</p>
        <Link className="kimish-text-link" to="/shop">{content.promise?.button_text} <ArrowRight size={17}/></Link>
      </div>
      <div className="quality-promise-steps">
        {['promise-selection','promise-quality','promise-care','promise-delivery'].map((key,index)=>({section:content[key],Icon:[Leaf,BadgeCheck,PackageCheck,Truck][index]})).filter(item=>item.section).map(({section,Icon},index) => <article className="quality-promise-step" key={section.key}>
          <div className="quality-step-marker"><Icon size={23} strokeWidth={1.3}/><span>0{index + 1}</span></div>
          <div><h3>{section.title}</h3><p>{section.body}</p></div>
        </article>)}
      </div>
    </section>}

    {(bottom) && <section className="ingredients-finale" aria-label="Good food begins with good ingredients">
      <div className="ingredients-finale-banner">
        <img src={bottom?.image} width="2048" height="837" loading="lazy" alt="Good Food Begins with Good Ingredients. At Kimish, we bring together a carefully selected range of dry fruits, nuts, seeds and everyday snacking favourites, packed with care to deliver quality you can enjoy every day."/>
        <Link className="button button-dark ingredients-finale-link" to={bottom?.link || "/shop"}>{bottom?.button_text} <ArrowRight size={16} aria-hidden="true"/></Link>
      </div>
    </section>}

    {banners.filter(b=>b.placement==='promotion').map(b=><section className="ingredients-finale" key={b.id}><div className="promo-card">{b.image&&<img src={b.image} alt={b.title}/>}<h2>{b.title}</h2><p>{b.subtitle}</p><Link className="btn btn-outline" to={b.link}>{b.button_text}</Link></div></section>)}
    {content_sections.filter(s=>!['hero','everyday','story','promise'].includes(s.key)&&!s.key.startsWith('story-')&&!s.key.startsWith('promise-')).map(s=><section className="home-section" key={s.id}><span className="eyebrow">{s.subtitle}</span><h2>{s.title}</h2><p>{s.body}</p>{s.image&&<img src={s.image} alt={s.title}/>}<Link className="btn btn-outline" to={s.link}>{s.button_text||'Explore'}</Link></section>)}
    <section className="service-strip"><div><Truck/><span><b>Free shipping</b> above ₹{settings.free_shipping_threshold || 499}</span></div><div><CreditCard/><span><b>Secure payments</b> every time</span></div><div><Headphones/><span><b>Customer support</b> when you need it</span></div><div><Sparkles/><span><b>Premium gifting</b> made effortless</span></div></section>
  </main>
}
