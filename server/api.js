import express from 'express'
import { createPool } from './db.js'
import { createRazorpay } from './integrations/razorpay.js'
import { createShiprocket } from './integrations/shiprocket.js'
import { requireAdmin } from './middleware/adminSession.js'
import { errorHandler } from './middleware/errors.js'
import { jsonBody, noStore, sameOriginWrites, securityHeaders } from './middleware/security.js'
import { adminAccountRoutes } from './routes/adminAccount.js'
import { adminAuthRoutes } from './routes/adminAuth.js'
import { adminOrderRoutes } from './routes/adminOrders.js'
import { adminRecordRoutes } from './routes/adminRecords.js'
import { checkoutRoutes } from './routes/checkout.js'
import { paymentRoutes } from './routes/payments.js'
import { storeRoutes } from './routes/store.js'
import { webhookRoutes } from './routes/webhooks.js'

// Builds the Express API (used by the Vite dev server, server/start.js and the Vercel function).
// Callers add the customer phone-login handler (auth.js) afterwards, so it runs after these routes.
export function createApi(env) {
  const pool = createPool(env)
  const origin = env.AUTH_ORIGIN || 'http://localhost:5173'
  // Shared by every router: configuration, database and outside services
  const ctx = {
    env,
    pool,
    origin,
    razorpay: createRazorpay(env),
    shiprocket: createShiprocket(env),
    // In-memory request counters for admin login, password reset and public checkout limits
    attempts: new Map(),
  }

  const api = express()
  api.disable('x-powered-by')
  api.use(securityHeaders)
  api.use(jsonBody)
  api.use('/api', noStore, sameOriginWrites(origin))

  // Admin: sign-in and recovery first, then everything else requires a session.
  // Specific admin routers come before the generic /:module records router.
  api.use('/api/admin', adminAuthRoutes(ctx))
  api.use('/api/admin', requireAdmin(pool))
  api.use('/api/admin', adminAccountRoutes(ctx), adminOrderRoutes(ctx), adminRecordRoutes(ctx))

  // Storefront
  api.use('/api', storeRoutes(ctx), checkoutRoutes(ctx), paymentRoutes(ctx), webhookRoutes(ctx))

  api.use('/api', errorHandler)
  return { api, pool }
}
