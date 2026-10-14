# Kimish Premium Ecommerce - React/Vite

A premium, mobile-first React ecommerce storefront redesigned around the supplied Kimish logo and a cream/chocolate/olive visual system.

## Included

- Premium B2C homepage
- Category-based shopping
- Weight/size variants
- Product listing/detail pages
- Search, filter and sort
- Best sellers/new arrivals
- Coupon codes
- Promotional banners
- Wishlist
- Cart and quantity updates
- Guest checkout flow
- Account shell
- Order tracking shell
- No-returns communication
- Ratings/reviews UI
- Related products
- WhatsApp support shortcut
- SEO-friendly routes/alt text structure
- Meta Pixel hook comments
- Mobile responsive design
- Admin dashboard shell
- LocalStorage cart/wishlist persistence

## Demo coupons

- KIMISH10: 10% off above ₹999
- SAVE150: ₹150 off above ₹1499

## Run

```bash
npm install
npm run dev
```

## Production integrations still required

- Actual Kimish Amazon catalog/product data
- Backend/database/API
- Payment gateway (Razorpay/PayU/Cashfree/Stripe/etc.)
- Courier/logistics API (Shiprocket/Delhivery/etc.)
- Authentication/OTP
- Inventory sync
- Real orders and order tracking
- Meta Pixel initialization and event payloads
- Real WhatsApp support number
- Final legal/policy copy
- Admin authentication and backend CRUD

## Suggested backend choices

For a fast custom build: Supabase + React.
For commerce-heavy requirements: Shopify Headless, Medusa or a custom Node.js backend.

## White-screen / destroy cleanup fix

This version uses explicit block-bodied React effects so the effects never accidentally return a cleanup value, and StrictMode is disabled in the starter entry point during initial integration testing.

## Design update

- Uses `/public/kimish-logo.png` from the supplied brand logo
- Premium cream, chocolate and olive color theme
- Redesigned homepage, navigation, cards, footer and all supporting ecommerce pages
- Responsive layouts for desktop, tablet and mobile

## Product image update

The supplied Kimish product photos are bundled locally in `public/products/` and are used for Cashew, Mamra Almond, Golden Raisins, Dried Cranberries and Makhana product cards/detail pages.

## September 2026 implementation update

- Product detail pages now include an admin-editable “About this item” field (one bullet per line) plus redesigned product-information cards.
- Customised Gifts now opens a dedicated `/customised-gifts` listing page.
- Gift boxes are stored in PostgreSQL and have full admin CRUD under **Customised Gift Boxes**.
- Existing admin CRUD covers products, categories, variants/inventory, product images, customers, addresses, orders, coupons, banners, homepage sections, pages/policies, reviews, navigation, site settings and administrators.
- Run `npm run db:setup` after updating so the additive schema migration and seeded gift-box records are applied.
- Local admin URL and credentials are stored in `ADMIN_CREDENTIALS.local.md`; change the password before any non-local deployment.

Note: payment gateway, courier API, production OTP provider and live inventory integrations remain external integrations and are not simulated as production services.

## Admin content architecture additions

The admin sidebar is grouped by Dashboard, Catalogue, Sales & Fulfilment, Website & Content, and System. Menu Management controls database-backed header/footer links. Customised Gift Boxes now store product-style merchandising, price, stock, SKU, shipping dimensions and SEO fields. Pages & Policies uses multi-line textareas. Product lists include a thumbnail.

## SEO and Meta Pixel

Set `site_url` and `meta_pixel_id` under Admin > Site Settings. The storefront generates route-aware page titles, descriptions, canonical URLs and Open Graph metadata. When a Meta Pixel ID is configured, the Meta Pixel script is loaded and PageView events are sent; the existing cart hook can be extended with commerce event payloads.
