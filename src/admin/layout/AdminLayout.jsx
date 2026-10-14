import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import ChangePasswordDialog from '../components/ChangePasswordDialog'
import { useAdminSession } from '../session/AdminSession'
import Sidebar from './Sidebar'

// Back-office shell for signed-in pages: top bar with account actions, module sidebar and the workspace
export default function AdminLayout() {
  const { admin, signOut, endSession } = useAdminSession()
  const [changingPassword, setChangingPassword] = useState(false)
  return (
    <div className="admin-page admin-app">
      <header className="admin-topbar">
        <Link className="admin-brand" to="/admin">
          <img src="/kimish-logo.png" alt="Kimish" />
          <span>Back office</span>
        </Link>
        <div className="admin-topbar-actions">
          <div className="admin-user">
            <strong>{admin.name}</strong>
            {admin.email}
          </div>
          <a className="btn btn-outline" href="/" target="_blank" rel="noopener">
            View store
          </a>
          <button className="btn btn-outline" onClick={() => setChangingPassword(true)}>
            Change password
          </button>
          <button className="btn btn-primary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <div className="admin-shell">
        <Sidebar />
        <main className="admin-workspace">
          <Outlet />
        </main>
      </div>
      {changingPassword && (
        <ChangePasswordDialog
          onClose={() => setChangingPassword(false)}
          onChanged={(message) => endSession(message)}
        />
      )}
    </div>
  )
}
