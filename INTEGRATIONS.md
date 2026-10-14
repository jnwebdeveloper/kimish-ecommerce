# Kimish payments, shipping and database

## Razorpay
1. Create Razorpay Test Mode API keys.
2. Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and a webhook secret to `.env`.
3. Configure the Razorpay webhook URL as `https://YOUR-DOMAIN/api/webhooks/razorpay` and use the same webhook secret.
4. The browser only receives the public key id. The key secret remains server-side.
5. Checkout creates a Razorpay Order on the server. Successful checkout is signature-verified and the payment is fetched from Razorpay before the Kimish order is marked Paid.

## Shiprocket
1. In Shiprocket Settings > API create a dedicated API user (not your normal account login).
2. Add `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, and the exact Shiprocket pickup-location nickname to `.env`.
3. Configure a shipment webhook to `https://YOUR-DOMAIN/api/webhooks/shiprocket`. If using a custom secret header, set the same value as `SHIPROCKET_WEBHOOK_SECRET`.
4. COD orders are sent to Shiprocket after local order creation. Razorpay orders are sent only after payment verification.
5. Shiprocket ids/status/raw responses are persisted in `shipments`.
6. Set `SHIPROCKET_PICKUP_PINCODE` so checkout can show courier rate estimates (`POST /api/shipping/rates`). The server re-checks the chosen courier rate when the order is placed.
7. The `shipping_methods` site setting controls which checkout shipping options appear (comma-separated: `shiprocket,none,inhouse`; default all three). Only `shiprocket` orders are booked with Shiprocket; `inhouse` uses the `shipping_fee`/`free_shipping_threshold` settings and `none` charges nothing.

## Database
Run `npm run db:setup` after changing `.env`. It creates/migrates PostgreSQL and seeds storefront content.

Core commerce tables: `categories`, `products`, `variants`, `product_images`, `customers`, `addresses`, `orders`, `order_items`, `payments`, `shipments`, `coupons`, `reviews`.

CMS/admin tables: `banners`, `content_sections`, `pages`, `navigation`, `gift_boxes`, `settings`, `admins`, `admin_sessions`, `audit_logs`.

Integration trace table: `integration_events` stores provider webhook events for diagnostics/audit.

Do not commit `.env`, Razorpay secrets, Shiprocket credentials, webhook secrets, or production database passwords.
