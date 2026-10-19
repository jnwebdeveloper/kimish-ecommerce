# Website and admin update

## Enable on an existing store

Configure the store's DATABASE_URL in .env, then run `npm run db:migrate` before starting the updated application. This creates SEO storage and missing page/settings defaults without overwriting existing records. Run `npm run build` for deployment. New installations can use `npm run db:setup`.

## Admin controls

- All record lists have search, a column/value filter, Clear, and ascending/descending sorting through column headings. Image and Actions headings are not sortable. Filters and sorting operate on records loaded by the existing list API (up to 1,000 records).
- Website & Content → SEO Pages: add an exact website path such as `/`, `/shop`, `/about-us` or a product URL. Configure title, description, sharing image and search visibility. Site Settings contains default `seo_title` and `seo_description`. Metadata is applied by the client-side storefront; server-side rendering is not added.
- Website & Content → Meta Pixel: save a numeric Meta Pixel ID. Blank disables future tracking. Page views and existing cart/purchase events target that ID. Admin pages do not load the pixel.
- Website & Content → Pages & Policies: edit and publish About Us, Contact Us, Terms & Conditions and Privacy Policy. Public URLs are `/about-us`, `/contact-us`, `/terms-and-conditions`, and `/privacy-policy`. Footer links are included. Contact details use `support_email`, `support_phone`, and `support_hours` in Site Settings.
- About Us and Contact Us include editable starter copy. Legal pages start as drafts. Replace their content with the business policies and tick Published.
- Gift images occupy the full gallery. Product/gift cards and detail images show a fallback when an image fails. A Kimish K favicon is included for website and admin.

## Verification

Production build and ESLint passed. All 22 automated tests passed using an isolated local PostgreSQL database. Browser checks verified the gift image, published-page filtering and title sorting, saving page content and reading it on the storefront, SEO editing and resulting metadata, favicon, and Meta Pixel screen. No production database or live tracking account was changed.
