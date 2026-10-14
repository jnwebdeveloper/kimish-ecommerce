# Kimish store administration

Open http://localhost:5173/admin. The initial email and generated password are in `ADMIN_CREDENTIALS.local.md` (local only). Passwords are hashed in PostgreSQL; admin sessions expire after eight hours. Administrators can manage additional administrator accounts.

## Start locally

Node.js 22+ and Docker are required.

```sh
npm install
docker compose up -d
npm run db:setup
npm run dev
```

The configured `.env` already contains this installation's database and initial admin credentials. On another machine, copy `.env.example` to `.env`, replace password placeholders, and ensure `DATABASE_URL` matches `POSTGRES_PASSWORD`. Setup creates tables and seeds the catalog, homepage content, settings and initial administrator without overwriting existing rows. Changing `ADMIN_PASSWORD` later does not change an existing administrator's password; use Administrators in the panel.

PostgreSQL database: `kimish`, user: `kimish`, host: `127.0.0.1`, port: `5434`. Connection credentials are in `.env`. Docker's named volume retains records when the container stops or restarts. Do not remove the volume unless deliberately resetting the database. The full table/column definitions and relationships are in `database/schema.sql`.

## Modules

- Products, categories, variants, stock and product images.
- Customers and addresses.
- Orders: create manual orders, inspect line items, change fulfilment/payment status, tracking and internal notes, cancel or delete. Order lines retain snapshots of purchased names and prices. Cancellation restores stock once.
- Coupons and offers.
- Banners, homepage sections, pages/policies and navigation links.
- Review moderation, site settings and administrator accounts.
- Read-only activity history of administrator changes.

Create a product and at least one variant to show it in the shop. Unpublish to hide products or content. Referenced categories cannot be deleted until products are reassigned. Images accept existing `/products/...` and `/brand-banners/...` paths or HTTPS image URLs.

Homepage section keys `hero`, `everyday`, `story` and `promise` control the main editorial areas. `story-ingredients`, `story-care`, `story-moments` and the four `promise-*` records control their cards. Other keys create additional lower-page sections. Banner placements are hero, seasonal, bottom and promotion. The bottom artwork contains baked-in text; replace its image to change that lettering. Layout, decorative labels and icons remain part of the design in code.

Site settings include shipping fee, free-shipping threshold, support phone, support hours, Instagram label and footer description. Orders, customers and addresses are saved in their respective tables. Prices, totals and stock are validated by the server. Cart and wishlist selections are retained in the browser; they are not customer database records.

## Phone OTP

Customers log in at `/login` (or `/account`) with a 10-digit Indian mobile number and a six-digit SMS code sent through Twilio Verify. Without Twilio credentials, SMS login is disabled and guest checkout remains available.

Setup:

1. Create a Twilio account at https://www.twilio.com/console. Copy the **Account SID** and **Auth Token** from the console dashboard.
2. Go to **Verify → Services → Create new**, give it a friendly name such as `Kimish` (this appears in the SMS), enable the **SMS** channel, and copy the **Service SID** (starts with `VA`).
3. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_VERIFY_SERVICE_SID` in `.env` locally, and in Vercel → Project → Settings → Environment Variables for production. Never put them in `VITE_*` variables.
4. Set `AUTH_ORIGIN` to the exact site origin with no trailing slash (`http://localhost:5173` locally, e.g. `https://kimish.in` in production). Login requests from any other origin are rejected with "Request origin is not allowed".
5. Run `npm run db:migrate` (or `npm run db:setup`) so the `customer_otp_challenges` and `auth_rate_limits` tables exist, then restart or redeploy.

Trial Twilio accounts can only send SMS to numbers verified under **Phone Numbers → Verified Caller IDs**. Upgrade the account before launch. Under Verify → Settings → Geo permissions, India must be allowed.

Limits: one code per number per 60 seconds, 5 per number and 10 per IP per hour, 5 wrong attempts per code, codes expire after 10 minutes. Twilio Verify enforces its own limits on top. Only Twilio-approved codes create a customer session (7 days, HttpOnly cookie). Sessions, pending challenges and rate limits are stored in PostgreSQL, so login works across Vercel serverless instances.

Online payment collection is not configured. Checkout supports cash on delivery; adding a payment gateway requires its server integration and verified payment callbacks.

## Checks and production build

```sh
npm test
npm run build
```

Tests exercise real PostgreSQL CRUD and checkout transactions using temporary records that are cleaned up, and simulated OTP-provider responses. They do not send SMS. Keep the database running for tests.

For the built app, set `AUTH_ORIGIN=http://localhost:3000` (or the actual HTTPS storefront origin), then run `npm start`. This serves both the compiled storefront and API on port 3000. Deploy behind HTTPS, use unique production credentials and database backups, and keep `.env` and `ADMIN_CREDENTIALS.local.md` private. A static-only host cannot run this database API.
