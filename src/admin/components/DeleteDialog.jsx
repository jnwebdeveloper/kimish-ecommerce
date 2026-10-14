import { useState } from 'react'
import { apiRequest } from '../../data/StoreContext'
import Messages from './Messages'
import Modal from './Modal'

export default function DeleteDialog({ module, row, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function remove() {
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/api/admin/${module}/${row.id}`, null, 'DELETE')
      onDeleted('Record deleted.')
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }
  return (
    <Modal onClose={onClose} busy={busy} aria-label="Delete record">
      <h2>Delete this record?</h2>
      <p>{row.name || row.title || row.order_number || row.id}</p>
      <p>This removes it from the database. Related records may prevent deletion.</p>
      <Messages error={error} />
      <button disabled={busy} className="btn btn-primary" onClick={remove}>
        Confirm delete
      </button>{' '}
      <button className="btn btn-outline" onClick={onClose}>
        Cancel
      </button>
    </Modal>
  )
}
