// Sends Shiprocket-style courier tracking webhooks to the local app, to test an order end to end
// (Shipped → Out for Delivery → Delivered) when the sandbox courier never really moves the parcel.
//
//   node ops/simulate-tracking.mjs <AWB>                     full journey, 2 s apart
//   node ops/simulate-tracking.mjs <AWB> "OUT FOR DELIVERY"  just one status
//   SIMULATE_URL=http://localhost:3000 node ops/simulate-tracking.mjs <AWB>
//
// Uses SHIPROCKET_WEBHOOK_SECRET from .env as the x-api-key header, like Shiprocket does.
import { loadEnv } from 'vite'

const [awb, ...statuses] = process.argv.slice(2)
if (!awb) {
  console.error('Usage: node ops/simulate-tracking.mjs <AWB> [status ...]')
  process.exit(1)
}
const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
const base = (env.SIMULATE_URL || 'http://localhost:5173').replace(/\/+$/, '')
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error('Refusing to send simulated tracking to a non-local server:', base)
  process.exit(1)
}
const journey = statuses.length
  ? statuses
  : ['PICKED UP', 'IN TRANSIT', 'OUT FOR DELIVERY', 'DELIVERED']

for (const [i, status] of journey.entries()) {
  if (i) await new Promise((r) => setTimeout(r, 2000))
  const r = await fetch(`${base}/api/webhooks/courier-updates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.SHIPROCKET_WEBHOOK_SECRET ? { 'x-api-key': env.SHIPROCKET_WEBHOOK_SECRET } : {}),
    },
    body: JSON.stringify({
      awb,
      current_status: status,
      shipment_status: status,
      current_timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }),
      scans: [
        { date: new Date().toISOString(), activity: `${status} (simulated)`, location: 'Test hub' },
      ],
    }),
  })
  console.log(`${status.padEnd(18)} → HTTP ${r.status}`)
  if (!r.ok) process.exit(1)
}
console.log('Done. Open the order in Admin → Orders to see the new status.')
