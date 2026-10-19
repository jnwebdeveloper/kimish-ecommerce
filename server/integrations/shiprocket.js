import { httpError } from '../lib/http.js'

// Shiprocket API: login token (cached per server instance), pickup addresses, courier rates, shipments
export function createShiprocket(env, log) {
  // SHIPROCKET_BASE_URL switches between live (default) and sandbox; with or without the /v1/external suffix
  const root = String(env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1\/external$/, '')
  const base = `${root}/v1/external`
  // The sandbox gateway answers 498 "Access Denied" unless the request carries the sandbox panel's Referer
  // (undocumented; observed 2026-10-16). Live ignores it, so it is only sent to sandbox hosts.
  const sandbox = /sandbox/i.test(new URL(root).hostname)
  const headers = (extra) => ({
    ...(sandbox ? { Referer: 'https://sandbox.shiprocket.in/' } : {}),
    ...extra,
  })
  let auth = null

  async function login() {
    if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD)
      throw new Error('Shiprocket credentials are not configured.')
    const r = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
    })
    const text = await r.text().catch(() => '')
    let d = {}
    try {
      d = JSON.parse(text)
    } catch {
      // Not JSON (a gateway block page); the text itself is kept below
    }
    if (!r.ok || !d.token)
      // Keep Shiprocket's own status and message for the log (it never echoes the password).
      // A gateway block (e.g. sandbox 498 "Access Denied") answers in plain text, not JSON.
      throw Object.assign(new Error(`Shiprocket authentication failed (${root}).`), {
        providerStatus: r.status,
        providerMessage: String(d.message || text)
          .trim()
          .slice(0, 200),
      })
    return d.token
  }

  // Why a Shiprocket call couldn't authenticate, for the logs (no credentials)
  const loginFailure = (e) => ({
    reason: e.message,
    providerStatus: e.providerStatus,
    providerMessage: e.providerMessage,
    retryAt: e.retryAt,
  })

  // After Shiprocket rejects the credentials, stop retrying for a while: every admin page load and
  // checkout rate quote would otherwise try again, and Shiprocket blocks the user after repeated
  // failures. Network errors (no providerStatus) are not remembered. Restarting the server clears it.
  const cooldownMs = 15 * 60000
  let rejected = null

  // Shiprocket tokens last 10 days; refresh after 8, or sooner if a call is rejected
  async function token() {
    if (auth && auth.until > Date.now()) return auth.token
    if (rejected && rejected.retryAt > Date.now()) throw rejected
    let value
    try {
      value = await login()
    } catch (e) {
      if (e.providerStatus) {
        e.retryAt = Date.now() + cooldownMs
        rejected = e
      }
      throw e
    }
    rejected = null
    auth = { token: value, until: Date.now() + 8 * 864e5 }
    return value
  }

  // Admin-facing explanation of a failed login, including Shiprocket's reason and the next retry
  const loginProblem = (e) => {
    const reason = e.providerMessage ? ` Shiprocket says: "${e.providerMessage}"` : ''
    const retry = e.retryAt
      ? ` Login will be retried after ${new Date(e.retryAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST (or restart the server after fixing the credentials).`
      : ''
    return `${e.message}${reason} Check SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD (use a Shiprocket API user).${retry}`
  }

  async function pickups() {
    let bearer
    try {
      bearer = await token()
    } catch (e) {
      log.warn('Shiprocket login failed', loginFailure(e))
      throw httpError(503, loginProblem(e))
    }
    const r = await fetch(`${base}/settings/company/pickup`, {
      headers: headers({ Authorization: `Bearer ${bearer}` }),
    })
    const d = await r.json().catch(() => ({}))
    if (r.status === 401) auth = null
    if (!r.ok) {
      log.warn('Shiprocket pickup addresses unavailable', {
        providerStatus: r.status,
        providerMessage: String(d.message || '').slice(0, 200),
      })
      throw httpError(502, 'Could not load pickup addresses from Shiprocket.')
    }
    return (d.data?.shipping_address || [])
      .map((a) => ({
        location: String(a.pickup_location || ''),
        address: [a.address, a.address_2].filter(Boolean).join(', '),
        city: String(a.city || ''),
        state: String(a.state || ''),
        pincode: String(a.pin_code || ''),
      }))
      .filter((a) => a.location && /^\d{6}$/.test(a.pincode))
  }

  // Couriers for a delivery PIN code, cheapest first; [] when none serve it
  async function rates(pincode, weight, cod, settings) {
    const unavailable = (details) => {
      log.warn('Shiprocket rates unavailable', details)
      return httpError(503, 'Shiprocket rates are temporarily unavailable.')
    }
    if (!/^\d{6}$/.test(String(settings.shiprocket_pickup_pincode || '')))
      throw unavailable({
        reason: 'No Shiprocket pickup address is selected in Admin > Site Settings.',
      })
    let bearer
    try {
      bearer = await token()
    } catch (e) {
      throw unavailable(loginFailure(e))
    }
    const q = new URLSearchParams({
      pickup_postcode: settings.shiprocket_pickup_pincode,
      delivery_postcode: pincode,
      weight: String(weight),
      cod: cod ? '1' : '0',
    })
    const r = await fetch(`${base}/courier/serviceability/?${q}`, {
      headers: headers({ Authorization: `Bearer ${bearer}` }),
    })
    const d = await r.json().catch(() => ({}))
    if (r.status === 401) auth = null
    if (r.status === 404) return []
    if (!r.ok) throw httpError(502, 'Could not fetch Shiprocket rates. Please try again.')
    return (d.data?.available_courier_companies || [])
      .map((x) => ({
        id: String(x.courier_company_id),
        name: String(x.courier_name || 'Courier'),
        rate: Math.round(Number(x.rate ?? x.freight_charge) * 100) / 100,
        etd: String(x.etd || ''),
        days: String(x.estimated_delivery_days || ''),
      }))
      .filter((x) => Number.isFinite(x.rate) && x.rate >= 0)
      .sort((a, b) => a.rate - b.rate)
  }

  async function createOrder(payload) {
    const r = await fetch(`${base}/orders/create/adhoc`, {
      method: 'POST',
      headers: headers({
        Authorization: `Bearer ${await token()}`,
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(payload),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.message || 'Shiprocket order creation failed.')
    return d
  }

  // Authenticated JSON call; returns Shiprocket's body, or throws with Shiprocket's own message
  async function call(method, path, body) {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: headers({
        Authorization: `Bearer ${await token()}`,
        'Content-Type': 'application/json',
      }),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const d = await r.json().catch(() => ({}))
    if (r.status === 401) auth = null
    if (!r.ok) {
      const detail = d.message || Object.values(d.errors || {}).flat()[0] || `HTTP ${r.status}`
      throw Object.assign(new Error(`Shiprocket: ${detail}`), { providerStatus: r.status })
    }
    return d
  }

  // Books a courier and issues the AWB (tracking number). Without courierId Shiprocket picks
  // the account's default courier. Charges the Shiprocket wallet on live accounts.
  async function assignAwb(shipmentId, courierId) {
    const d = await call('POST', '/courier/assign/awb', {
      shipment_id: Number(shipmentId),
      ...(courierId ? { courier_id: Number(courierId) } : {}),
    })
    // On failure Shiprocket puts its reason in response.data as plain text, e.g.
    // "Error in generating awb with bluedart [BD-003]. Please contact support."
    const raw = d.response?.data
    const data = raw && typeof raw === 'object' ? raw : {}
    if (d.awb_assign_status !== 1 || !data.awb_code)
      throw new Error(
        `Shiprocket: ${data.awb_assign_error || (typeof raw === 'string' && raw) || d.message || 'the courier could not be assigned.'}`,
      )
    return {
      awb: String(data.awb_code),
      courierId: String(data.courier_company_id || courierId || ''),
      courierName: String(data.courier_name || ''),
    }
  }

  // Asks the courier to collect the parcel; returns the scheduled date when Shiprocket gives one
  async function requestPickup(shipmentId) {
    try {
      const d = await call('POST', '/courier/generate/pickup', {
        shipment_id: [Number(shipmentId)],
      })
      if (d.pickup_status !== 1 && !d.response)
        throw new Error(`Shiprocket: ${d.message || 'pickup could not be scheduled.'}`)
      return { scheduledAt: d.response?.pickup_scheduled_date || null }
    } catch (e) {
      // A repeat request for a shipment already queued is not a failure
      if (/already/i.test(e.message)) return { scheduledAt: null }
      throw e
    }
  }

  async function generateLabel(shipmentId) {
    const d = await call('POST', '/courier/generate/label', { shipment_id: [Number(shipmentId)] })
    if (!d.label_url)
      throw new Error(`Shiprocket: ${d.response || d.message || 'no label was returned.'}`)
    return { labelUrl: String(d.label_url) }
  }

  // Latest courier status and scan history for an AWB
  async function track(awb) {
    const d = await call('GET', `/courier/track/awb/${encodeURIComponent(awb)}`)
    const t = d.tracking_data || {}
    return {
      status: String(t.shipment_track?.[0]?.current_status || ''),
      trackUrl: String(t.track_url || ''),
      error: t.error ? String(t.error) : '',
      activities: (t.shipment_track_activities || []).map((a) => ({
        date: String(a.date || ''),
        activity: String(a.activity || a['sr-status-label'] || ''),
        location: String(a.location || ''),
      })),
    }
  }

  return { pickups, rates, createOrder, assignAwb, requestPickup, generateLabel, track }
}
