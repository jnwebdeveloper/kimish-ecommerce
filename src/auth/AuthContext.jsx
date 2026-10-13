import { createContext, useContext, useEffect, useState } from 'react'
const AuthContext = createContext(null)
export async function authRequest(path, body) {
  let response
  try { response = await fetch(`/api/auth/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }) }
  catch { throw new Error('Unable to connect. Please check your connection and try again.') }
  let result
  try { result = await response.json() } catch { throw new Error('Phone login is currently unavailable. You can continue as a guest.') }
  if (!response.ok) throw new Error(result.message || 'Please try again later.')
  return result
}
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [available, setAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => { let active = true; authRequest('session').then(data => { if (active) { setUser(data.user); setAvailable(data.available) } }).catch(() => {}).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])
  const logout = async () => { await authRequest('logout', {}); setUser(null) }
  return <AuthContext.Provider value={{ user, setUser, available, loading, logout }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
