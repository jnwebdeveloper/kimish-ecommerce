import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Smartphone, ShieldCheck } from 'lucide-react'
import { authRequest, useAuth } from '../auth/AuthContext'

export default function Account() {
  const { user, setUser, available, loading, logout } = useAuth()
  const [phone, setPhone] = useState(''), [code, setCode] = useState(''), [step, setStep] = useState('phone')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [remaining, setRemaining] = useState(0)
  const codeRef = useRef(null)
  useEffect(() => { if (!remaining) return; const timer = setTimeout(() => setRemaining(n => Math.max(0,n-1)), 1000); return () => clearTimeout(timer) }, [remaining])
  useEffect(() => { if (step === 'code') codeRef.current?.focus() }, [step])
  async function send(event) {
    event?.preventDefault(); if (busy || remaining) return
    setError('')
    if (!/^[6-9]\d{9}$/.test(phone)) { setError('Enter a valid 10-digit Indian mobile number.'); return }
    setBusy(true)
    try { const result = await authRequest('send', { phone: `+91${phone}` }); setRemaining(result.resendAfter || 60); setCode(''); setStep('code') }
    catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  async function verify(event) {
    event.preventDefault(); if (busy) return
    setError(''); setBusy(true)
    try { const result = await authRequest('verify', { code }); setUser(result.user); setCode(''); setStep('phone') }
    catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  async function signOut() { setError(''); setBusy(true); try { await logout() } catch (error) { setError(error.message) } finally { setBusy(false) } }
  return <main className="section page-top account-page">
    <div className="page-title"><span className="eyebrow">YOUR KIMISH ACCOUNT</span><h1>{user ? 'Welcome to Kimish' : 'Good things start here.'}</h1><p>{user ? 'You’re signed in with your verified mobile number.' : 'Sign in with your phone number. No password to remember.'}</p></div>
    <section className="phone-login-card" aria-labelledby="login-heading">
      <div className="login-icon"><Smartphone size={28} strokeWidth={1.4}/></div>
      <h2 id="login-heading">{user ? 'My account' : step === 'phone' ? 'Login with your phone' : 'Enter your verification code'}</h2>
      {loading ? <p role="status">Checking sign-in availability…</p> : user ? <><p>Verified number <strong>{user.phone}</strong></p><Link className="btn btn-primary full" to="/shop">Continue shopping</Link><button className="btn btn-outline full" disabled={busy} onClick={signOut}>Sign out</button></> : <>
        {!available && <p className="login-notice" role="status">Phone login is not available yet. You can continue shopping and check out as a guest.</p>}
        {step === 'phone' ? <form onSubmit={send}>
          <label htmlFor="login-phone">Mobile number</label>
          <div className="phone-input"><span>+91</span><input id="login-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile number" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} pattern="[6-9][0-9]{9}" maxLength={10} required disabled={busy}/></div>
          <p className="login-help">We’ll send a six-digit verification code by SMS.</p>
          <button className="btn btn-primary full" disabled={busy || !available || remaining > 0}>{busy ? 'Sending code…' : remaining ? `Try again in ${remaining}s` : 'Send OTP'}</button>
        </form> : <form onSubmit={verify}>
          <p>Enter the code sent to <strong>+91 {phone}</strong>.</p>
          <button type="button" className="login-text-button" disabled={busy} onClick={() => { setStep('phone'); setCode(''); setError('') }}>Change mobile number</button>
          <label htmlFor="login-code">Six-digit code</label><input ref={codeRef} className="otp-input" id="login-code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))} pattern="[0-9]{6}" maxLength={6} required disabled={busy}/>
          <button className="btn btn-primary full" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and log in'}</button>
          <button type="button" className="login-text-button" disabled={busy || remaining > 0} onClick={send}>{remaining ? `Resend code in ${remaining}s` : 'Resend code'}</button>
        </form>}
        <div className="login-reassurance"><ShieldCheck size={20}/><span>Your number is used to verify your account.</span></div><Link className="kimish-text-link" to="/shop">Continue as a guest →</Link>
      </>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  </main>
}
