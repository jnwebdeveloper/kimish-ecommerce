import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import Messages from '../components/Messages'
import { safeNext } from '../data/menu'
import { usePageTitle } from '../layout/usePageTitle'
import { SessionLoading, useAdminSession } from '../session/AdminSession'

export default function LoginPage() {
  const { admin, loading, flash, signIn } = useAdminSession()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  usePageTitle('Sign in')

  if (loading) return <SessionLoading />
  // Already signed in (or just signed in): continue to where the admin was going
  if (admin) return <Navigate to={safeNext(params.get('next'))} replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email, password)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <main className="admin-page admin-login">
      <div className="phone-login-card">
        <div className="admin-login-brand">
          <img src="/kimish-logo.png" alt="Kimish" />
          <span className="eyebrow">KIMISH BACK OFFICE</span>
          <h1>Administrator login</h1>
          <p>Manage your store securely.</p>
        </div>
        <Messages notice={flash} />
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <Messages error={error} />
          <button disabled={busy} className="btn btn-primary full">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
