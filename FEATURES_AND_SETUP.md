# Feature update and configuration

## Implemented in this update
- Three-level product category hierarchy with `parent_id`, ancestor/descendant depth validation and cycle prevention. Run `npm run db:setup` after upgrading. Existing categories remain top-level.
- Server-side validation for variants, coupons, customer mobile numbers, addresses, review ratings and admin emails.
- Authenticated admin password change: `POST /api/admin/change-password` with `currentPassword` and `newPassword`; invalidates all existing sessions. This is **not** email-based forgotten-password recovery.
- Admin image picker with short-lived Cloudflare R2 signed PUT upload, content-type and 8MB size restrictions. Supports image fields for products, product images, categories, banners, gift boxes, and content sections. Image records can be added repeatedly for galleries.

## Cloudflare R2 setup
Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` to `.env`. Configure the bucket CORS to allow PUT from your actual admin origin with Content-Type header. Use a public custom domain for `R2_PUBLIC_URL`. Limit the R2 API token to the intended bucket. Upload is direct from the browser to R2; the application only signs the request. Use a content moderation/virus scan and upload completion verification before treating untrusted uploads as production-safe.

## Still pending / requires live integration tests
- Email-based forgotten-password flow and secure email delivery provider
- End-to-end Razorpay live/test payments, Twilio OTP and Shiprocket account verification
- Comprehensive accessibility, SEO, Pixel conversion tracking, and consistent skeleton loaders
- All forms and CRUD workflows end-to-end, including mobile UX and permissions
- Automatic multiple-file upload in one selection (gallery records can currently be added one at a time)

## Run
`npm install`, `docker compose up -d`, `npm run db:setup`, `npm test`, `npm run dev`. Never publish `.env` or local credentials.
