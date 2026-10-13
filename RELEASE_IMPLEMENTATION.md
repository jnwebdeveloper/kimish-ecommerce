# Production hardening update

Implemented: admin password recovery endpoints with 20-minute hashed one-time tokens, Resend email delivery, session invalidation; SQL stock floor constraint and conditional decrement; security headers; Purchase Meta Pixel event on completed COD order or verified Razorpay payment; release invariant tests; backup/restore scripts.

## Mandatory configuration
Set RESEND_API_KEY, PASSWORD_RESET_FROM (verified sender), PUBLIC_SITE_URL, DATABASE_URL. Run `npm run db:migrate` after `npm run db:setup` on a fresh database. Existing databases must be migrated before starting the upgraded API. The reset link targets `/admin/reset-password`; **a frontend reset-password screen is not included in this update**, so the API alone is insufficient for user-facing recovery.

## Limitations
Meta Pixel needs a valid configured pixel ID, consent management and browser testing. Do not treat source-level tests as CRUD integration tests. Test database migrations, backup restoration, concurrency and payment webhooks in staging. Restore only into a verified target database. R2, OTP, Razorpay, and Shiprocket require live service verification. The nonnegative stock migration will fail if negative stock already exists; repair records before migration. No full security penetration test was performed.
