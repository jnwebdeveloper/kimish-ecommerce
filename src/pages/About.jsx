import PageContent from '../components/PageContent'
import { Link } from 'react-router-dom'
import { ArrowRight, Leaf, Gift, Coffee, MoveUpRight } from 'lucide-react'
import StoreImage from '../components/StoreImage'
import './About.css'

const moments = [
  {
    icon: Coffee,
    title: 'For your everyday',
    text: 'A handful with your morning coffee. A little crunch between meetings. Favourites that fit into your day.',
  },
  {
    icon: Leaf,
    title: 'For your pantry',
    text: 'Nuts, seeds and dry fruits to enjoy on their own, sprinkle over breakfast or bring into your favourite recipes.',
  },
  {
    icon: Gift,
    title: 'For someone special',
    text: 'Thoughtful gift boxes for celebrations, thank-you moments and the people you want to make smile.',
  },
]

export default function About({ page }) {
  return (
    <main className="kimish-about">
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-hero-copy">
          <span className="about-eyebrow">A LITTLE ABOUT KIMISH</span>
          <h1 id="about-title">
            Good food.
            <br />
            Little moments.
            <br />
            <em>Lasting joy.</em>
          </h1>
          <p>
            From everyday handfuls to gifts from the heart, discover a world of nuts, seeds and dry
            fruits worth sharing.
          </p>
          <Link className="about-button" to="/shop">
            Explore our collection <ArrowRight size={18} />
          </Link>
          <div className="about-hero-foot">
            <span /> Everyday favourites. Special occasions.
          </div>
        </div>
        <div className="about-hero-art">
          <div className="about-art-label">
            <Leaf size={17} strokeWidth={1.5} /> THE SIMPLE PLEASURES
          </div>
          <StoreImage
            src="/products/kimish-cashew.png"
            alt="Kimish cashew nuts with a bowl of cashews"
            width="1128"
            height="1098"
          />
          <div className="about-art-caption">
            <span>
              A little goodness,
              <br />
              <em>every day.</em>
            </span>
            <span className="about-caption-mark" aria-hidden="true">
              K.
            </span>
          </div>
        </div>
      </section>
      <div className="about-category-band" aria-label="Our collection">
        <span>Nuts</span>
        <i aria-hidden="true">✦</i>
        <span>Seeds</span>
        <i aria-hidden="true">✦</i>
        <span>Dry fruits</span>
        <i aria-hidden="true">✦</i>
        <span>Thoughtful gifts</span>
      </div>
      <section className="about-story" aria-labelledby="about-story-title">
        <div>
          <span className="about-eyebrow">OUR STORY</span>
          <h2 id="about-story-title">
            A place for your
            <br />
            <em>favourites.</em>
          </h2>
        </div>
        <div className="about-story-copy">
          <p className="about-story-lead">Simple pleasures deserve a place in every day.</p>
          <PageContent className="about-published-story" value={page.content} />
          <Link className="about-text-link" to="/shop">
            Find your next favourite <MoveUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="about-moments" aria-labelledby="about-moments-title">
        <div className="about-section-heading">
          <span className="about-eyebrow">MADE FOR LIFE’S LITTLE MOMENTS</span>
          <h2 id="about-moments-title">
            However you enjoy it,
            <br />
            make it <em>Kimish.</em>
          </h2>
        </div>
        <div className="about-moment-grid">
          {moments.map(({ icon: Icon, title, text }, index) => (
            <article key={title}>
              <div className="about-moment-top">
                <Icon size={26} strokeWidth={1.4} />
                <span>0{index + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="about-gifting" aria-labelledby="about-gift-title">
        <div className="about-gift-photo">
          <StoreImage
            src="/gifts/custom-gift-pink-open.jpeg"
            alt="An open Kimish gift box with an assortment of products"
            loading="lazy"
          />
        </div>
        <div className="about-gift-copy">
          <span className="about-eyebrow">GOOD THINGS ARE BETTER SHARED</span>
          <h2 id="about-gift-title">
            A thoughtful gift.
            <br />
            <em>A beautiful moment.</em>
          </h2>
          <p>
            For festive gatherings, personal milestones or a simple thank you. Explore gift boxes
            that bring your favourite flavours together.
          </p>
          <Link className="about-button about-button-light" to="/customised-gifts">
            Discover our gift boxes <ArrowRight size={18} />
          </Link>
        </div>
      </section>
      <section className="about-closing">
        <span className="about-eyebrow">YOUR NEXT FAVOURITE IS WAITING</span>
        <h2>
          A little more goodness.
          <br />
          <em>Start here.</em>
        </h2>
        <div>
          <Link className="about-button" to="/shop">
            Shop Kimish <ArrowRight size={18} />
          </Link>
          <Link className="about-text-link" to="/contact-us">
            Let’s talk <MoveUpRight size={17} />
          </Link>
        </div>
      </section>
    </main>
  )
}
