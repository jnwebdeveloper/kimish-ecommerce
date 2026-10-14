import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import Loading from '../../components/Loading'
import { apiRequest } from '../../data/StoreContext'

const AdminSessionContext = createContext(null)

// Signed-in administrator, module definitions (meta) and the cache of lists shared between screens
export function AdminSessionProvider({ children }) {
  const [admin, setAdmin] = useState(null),
    [loading, setLoading] = useState(true),
    [meta, setMeta] = useState({}),
    // Message for the login page after the session ends (e.g. "Password changed")
    [flash, setFlash] = useState('')
  const cache = useRef({})

  useEffect(() => {
    apiRequest('/api/admin/session')
      .then((d) => setAdmin(d.admin))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const endSession = useCallback((message = '') => {
    cache.current = {}
    setMeta({})
    setFlash(message)
    setAdmin(null)
  }, [])

  useEffect(() => {
    if (!admin) return
    apiRequest('/api/admin/meta')
      .then(setMeta)
      .catch((e) => {
        if (e.status === 401) endSession()
      })
  }, [admin, endSession])

  const value = useMemo(
    () => ({
      admin,
      loading,
      meta,
      cache,
      flash,
      endSession,
      signIn: async (email, password) => {
        const { admin } = await apiRequest('/api/admin/login', { email, password })
        setFlash('')
        setAdmin(admin)
      },
      signOut: async () => {
        await apiRequest('/api/admin/logout', {})
        endSession()
      },
    }),
    [admin, loading, meta, flash, endSession],
  )
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}

export const useAdminSession = () => useContext(AdminSessionContext)

export function SessionLoading() {
  return (
    <main className="admin-boot">
      <Loading message="Loading administration…" />
    </main>
  )
}

// Sends signed-out visitors to the login page, remembering where they were going
export function RequireAdmin({ children }) {
  const { admin, loading } = useAdminSession()
  const location = useLocation()
  if (loading) return <SessionLoading />
  if (!admin) {
    const here = location.pathname + location.search
    return (
      <Navigate
        to={here === '/admin' ? '/admin/login' : '/admin/login?next=' + encodeURIComponent(here)}
        replace
      />
    )
  }
  return children
}
