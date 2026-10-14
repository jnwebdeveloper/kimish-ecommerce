import { useEffect, useState } from 'react'
import { apiRequest } from '../../data/StoreContext'

// Lets the admin choose which saved Shiprocket pickup address is used for rate estimates and shipment creation.
export default function ShiprocketPickupPanel() {
  const [addresses, setAddresses] = useState([]),
    [selected, setSelected] = useState(''),
    [saved, setSaved] = useState('')
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const data = await apiRequest('/api/admin/shiprocket/pickups')
      setAddresses(data.addresses)
      setSaved(data.selected)
      setSelected(data.selected || data.addresses[0]?.location || '')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  async function save() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = await apiRequest('/api/admin/shiprocket/pickups', { location: selected })
      setSaved(data.selected)
      setNotice('Pickup address saved. Shiprocket rates and shipments now use this address.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const current = addresses.find((a) => a.location === selected)
  return (
    <section className="shiprocket-pickup">
      <h3>Shiprocket pickup address</h3>
      <p className="admin-module-help">
        Courier rates are calculated from this address&apos;s PIN code, and Shiprocket shipments are
        created from it. Add or edit addresses in Shiprocket under Settings › Pickup Addresses, then
        reload.
      </p>
      {loading ? (
        <p>Loading pickup addresses from Shiprocket…</p>
      ) : (
        addresses.length > 0 && (
          <div className="admin-toolbar">
            <select
              aria-label="Shiprocket pickup address"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value)
                setNotice('')
              }}
            >
              {addresses.map((a) => (
                <option key={a.location} value={a.location}>
                  {a.location} · {a.city} {a.pincode}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              disabled={busy || !selected || selected === saved}
              onClick={save}
            >
              {busy ? 'Saving…' : selected === saved ? 'Saved' : 'Save pickup address'}
            </button>
            <button className="btn btn-outline" disabled={loading} onClick={load}>
              Reload
            </button>
          </div>
        )
      )}
      {!loading && !error && !addresses.length && (
        <p>No pickup addresses found in your Shiprocket account. Add one in Shiprocket first.</p>
      )}
      {current && (
        <p className="shiprocket-pickup-address">
          {[current.address, current.city, current.state, current.pincode]
            .filter(Boolean)
            .join(', ')}
        </p>
      )}
      {saved && !addresses.some((a) => a.location === saved) && !loading && (
        <p role="alert" className="error">
          The saved pickup address “{saved}” no longer exists in Shiprocket. Choose another one.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      {error && (
        <button className="btn btn-outline" onClick={load}>
          Try again
        </button>
      )}
    </section>
  )
}
