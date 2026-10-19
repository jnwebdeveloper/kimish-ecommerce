import { useEffect, useState } from 'react'
import { apiRequest } from '../../data/StoreContext'
import Messages from './Messages'

const when = (value) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

// Shipment section of the order details: Shiprocket ids, courier, tracking number, label,
// the "Ship" button (book courier + pickup + label) and a tracking refresh.
export default function ShipmentPanel({ orderId, onChange }) {
  const [s, setS] = useState(null),
    [activities, setActivities] = useState(null)
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [errorCode, setErrorCode] = useState(''),
    [notice, setNotice] = useState('')

  async function run(label, request, success) {
    setBusy(label)
    setError('')
    setErrorCode('')
    setNotice('')
    try {
      const data = await request()
      if (success) setNotice(success)
      return data
    } catch (e) {
      setError(e.message)
      setErrorCode(e.code || '')
    } finally {
      setBusy('')
    }
  }

  // Reloads the shipment without touching the messages (keeps a Ship error visible)
  const load = () =>
    apiRequest(`/api/admin/orders/${orderId}/shipment`)
      .then(setS)
      .catch((e) => setError(e.message))
  useEffect(() => {
    apiRequest(`/api/admin/orders/${orderId}/shipment`)
      .then(setS)
      .catch((e) => setError(e.message))
  }, [orderId])

  const ship = async (anyCourier = false) => {
    const d = await run(
      'ship',
      () => apiRequest(`/api/admin/orders/${orderId}/ship`, { anyCourier }),
      'Courier booked, pickup requested and label ready.',
    )
    if (d) setS(d)
    // A failed Ship may still have saved progress (e.g. the AWB before the label failed)
    else await load()
    onChange?.()
  }
  const track = async () => {
    const d = await run('track', () =>
      apiRequest(`/api/admin/orders/${orderId}/shipment/track`, {}),
    )
    if (d) {
      setS(d.shipment)
      setActivities(d.activities)
      if (d.note) setNotice(d.note)
      onChange?.()
    }
  }

  if (!s)
    return (
      <section className="shipment-panel">
        <h3>Shipment</h3>
        {error ? <Messages error={error} /> : <p>Loading shipment…</p>}
      </section>
    )
  if (!s.provider)
    return (
      <section className="shipment-panel">
        <h3>Shipment</h3>
        <p>No shipment record for this order.</p>
      </section>
    )
  if (s.provider !== 'shiprocket')
    return (
      <section className="shipment-panel">
        <h3>Shipment</h3>
        <p>
          {s.provider === 'inhouse'
            ? 'Delivered by your own (in-house) shipping.'
            : 'No shipping required for this order.'}
        </p>
      </section>
    )

  const booked = Boolean(s.awb_code)
  const done = booked && s.pickup_scheduled_at && s.label_url
  const unpaid = s.payment !== 'cod' && s.payment_status !== 'Paid'
  const canShip = !done && !unpaid && s.order_status !== 'Cancelled'
  const rows = [
    ['Shipment status', s.status],
    ['Order status', s.order_status],
    ['Courier', s.courier_name || '—'],
    ['Tracking number (AWB)', s.awb_code || 'Not booked yet'],
    ['Pickup requested', when(s.pickup_scheduled_at)],
    ['Delivered', when(s.delivered_at)],
    [
      'Shiprocket order / shipment',
      s.provider_order_id ? `${s.provider_order_id} / ${s.shipment_id}` : 'Not created yet',
    ],
    ['Last update', when(s.updated_at)],
  ]

  return (
    <section className="shipment-panel">
      <h3>Shipment · Shiprocket</h3>
      <dl className="shipment-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {booked && (s.booking_error || error) && (
        <p className="admin-module-help">
          Courier booked: {s.courier_name || 'courier'}, AWB <b>{s.awb_code}</b>. The steps after
          booking (label, pickup) did not finish; Retry shipping continues from there without
          booking again.
        </p>
      )}
      {s.booking_error && !error && (
        <p role="alert" className="error">
          Last booking attempt failed: {s.booking_error}
        </p>
      )}
      {unpaid && (
        <p className="admin-module-help">
          Online orders can be shipped once the payment is confirmed.
        </p>
      )}
      <Messages notice={notice} error={error} errorFirst />
      <div className="admin-toolbar">
        {canShip && (
          <button className="btn btn-primary" disabled={Boolean(busy)} onClick={() => ship(false)}>
            {busy === 'ship' ? 'Shipping…' : s.booking_error || booked ? 'Retry shipping' : 'Ship'}
          </button>
        )}
        {canShip && errorCode === 'courier_unavailable' && (
          <button className="btn btn-outline" disabled={Boolean(busy)} onClick={() => ship(true)}>
            Ship with any courier
          </button>
        )}
        {s.label_url && (
          <a className="btn btn-outline" href={s.label_url} target="_blank" rel="noreferrer">
            Download label
          </a>
        )}
        {booked && (
          <button className="btn btn-outline" disabled={Boolean(busy)} onClick={track}>
            {busy === 'track' ? 'Refreshing…' : 'Refresh tracking'}
          </button>
        )}
        {s.tracking_url && (
          <a className="btn btn-outline" href={s.tracking_url} target="_blank" rel="noreferrer">
            Tracking page
          </a>
        )}
      </div>
      {canShip && !booked && (
        <p className="admin-module-help">
          Ship books {s.courier_name || 'the courier chosen at checkout'} in Shiprocket (this
          charges your Shiprocket wallet on a live account), requests pickup and fetches the label.
        </p>
      )}
      {activities && (
        <ol className="shipment-activities">
          {activities.length ? (
            activities.map((a, i) => (
              <li key={i}>
                <b>{a.activity}</b>{' '}
                <span>
                  {a.date}
                  {a.location && a.location !== 'NA' ? ` · ${a.location}` : ''}
                </span>
              </li>
            ))
          ) : (
            <li>No courier scans yet.</li>
          )}
        </ol>
      )}
    </section>
  )
}
