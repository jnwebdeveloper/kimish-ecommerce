import { useState } from 'react'
import { apiRequest } from '../../data/StoreContext'
import Messages from './Messages'
import Modal from './Modal'

// Changing the password ends every session, so success signs the admin out
export default function ChangePasswordDialog({ onClose, onChanged }) {
  const [currentPassword, setCurrentPassword] = useState(''),
    [newPassword, setNewPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await apiRequest('/api/admin/change-password', { currentPassword, newPassword })
      onChanged('Password changed. Please sign in again.')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <Modal onClose={onClose} busy={busy} aria-label="Change administrator password">
      <h2>Change password</h2>
      <form onSubmit={submit}>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>
        <label>
          New password (at least 12 characters)
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength="12"
            maxLength="128"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <Messages error={error} />
        <div className="admin-modal-actions">
          <button disabled={busy} className="btn btn-primary">
            Update password
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
