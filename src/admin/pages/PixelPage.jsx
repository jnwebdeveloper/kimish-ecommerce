import { useEffect, useState } from 'react'
import { apiRequest } from '../../data/StoreContext'
import { useModuleData } from '../data/useModuleData'
import { usePageTitle } from '../layout/usePageTitle'
import Messages from '../components/Messages'
export default function PixelPage() {
  usePageTitle('Meta Pixel')
  const { rows, error: loadError, reload } = useModuleData('settings')
  const [value, setValue] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const record = rows.find((row) => row.key === 'meta_pixel_id')
  useEffect(() => {
    setValue(record?.value || '')
  }, [record])
  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await apiRequest(
        '/api/admin/settings' + (record ? '/' + record.id : ''),
        {
          key: 'meta_pixel_id',
          value: value.trim(),
          description: 'Meta Pixel ID; leave blank to disable tracking',
        },
        record ? 'PUT' : 'POST',
      )
      setNotice('Meta Pixel settings saved.')
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <h2>Meta Pixel</h2>
      <p className="admin-module-help">
        Enter your Meta Pixel ID to enable storefront page views and supported shopping events.
        Leave it blank to disable tracking.
      </p>
      <Messages error={error || loadError} notice={notice} />
      <form onSubmit={save} className="admin-toolbar">
        <label>
          Meta Pixel ID
          <input
            aria-label="Meta Pixel ID"
            inputMode="numeric"
            pattern="[0-9]{5,30}"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" disabled={busy || !!loadError}>
          {busy ? 'Saving…' : 'Save pixel settings'}
        </button>
      </form>
    </>
  )
}
