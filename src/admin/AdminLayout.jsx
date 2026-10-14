import { Link } from 'react-router-dom'

// Back-office shell: top bar with account actions, module sidebar and the workspace.
export default function AdminLayout({admin,sidebar,onChangePassword,onSignOut,children}){
 return <div className="admin-page admin-app">
  <header className="admin-topbar">
   <Link className="admin-brand" to="/admin"><img src="/kimish-logo.png" alt="Kimish"/><span>Back office</span></Link>
   <div className="admin-topbar-actions">
    <div className="admin-user"><strong>{admin.name}</strong>{admin.email}</div>
    <a className="btn btn-outline" href="/" target="_blank" rel="noopener">View store</a>
    <button className="btn btn-outline" onClick={onChangePassword}>Change password</button>
    <button className="btn btn-primary" onClick={onSignOut}>Sign out</button>
   </div>
  </header>
  <div className="admin-shell">{sidebar}<main className="admin-workspace">{children}</main></div>
 </div>
}

export function AdminLogin({children}){
 return <main className="admin-page admin-login"><div className="phone-login-card"><div className="admin-login-brand"><img src="/kimish-logo.png" alt="Kimish"/><span className="eyebrow">KIMISH BACK OFFICE</span><h1>Administrator login</h1><p>Manage your store securely.</p></div>{children}</div></main>
}
