import { httpError } from '../lib/http.js'

const base = 'https://apiv2.shiprocket.in/v1/external'

// Shiprocket API: login token (cached per server instance), pickup addresses, courier rates, shipments
export function createShiprocket(env) {
  let auth = null

  async function login() {
    if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD)
      throw new Error('Shiprocket credentials are not configured.')
    const r = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
    })
    const d = await r.json()
    if (!r.ok || !d.token) throw new Error('Shiprocket authentication failed.')
    return d.token
  }

  // Shiprocket tokens last 10 days; refresh after 8, or sooner if a call is rejected
  async function token() {
    if (auth && auth.until > Date.now()) return auth.token
    const value = await login()
    auth = { token: value, until: Date.now() + 8 * 864e5 }
    return value
  }

  async function pickups() {
    let bearer
    try {
      bearer = await token()
    } catch (e) {
      throw httpError(503, `${e.message} Check SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.`)
    }
    const r = await fetch(`${base}/settings/company/pickup`, {
      headers: { Authorization: `Bearer ${bearer}` },
    })
    const d = await r.json().catch(() => ({}))
    if (r.status === 401) auth = null
    if (!r.ok) throw httpError(502, 'Could not load pickup addresses from Shiprocket.')
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
    const unavailable = (reason) => {
      console.warn('Shiprocket rates unavailable:', reason)
      return httpError(503, 'Shiprocket rates are temporarily unavailable.')
    }
    if (!/^\d{6}$/.test(String(settings.shiprocket_pickup_pincode || '')))
      throw unavailable('No Shiprocket pickup address is selected in Admin > Site Settings.')
    let bearer
    try {
      bearer = await token()
    } catch (e) {
      throw unavailable(e.message)
    }
    const q = new URLSearchParams({
      pickup_postcode: settings.shiprocket_pickup_pincode,
      delivery_postcode: pincode,
      weight: String(weight),
      cod: cod ? '1' : '0',
    })
    const r = await fetch(`${base}/courier/serviceability/?${q}`, {
      headers: { Authorization: `Bearer ${bearer}` },
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
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.message || 'Shiprocket order creation failed.')
    return d
  }

  return { pickups, rates, createOrder }
}
