import { emptyCatalog, readCatalog, saveCatalog, validCatalog } from './storeCache'
import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react'
const StoreContext = createContext(null)
export async function apiRequest(path, body, method) {
  const response = await fetch(path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: body ? { 'Content-Type': 'application/json' } : {},
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  })
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('The server is unavailable. Please try again.')
  }
  if (!response.ok)
    throw Object.assign(new Error(data.message || 'Request failed.'), {
      status: response.status,
      code: data.code,
    })
  return data
}
export function StoreProvider({ children }) {
  const [data, setData] = useState(() => {
    try {
      return readCatalog(window.sessionStorage)
    } catch {
      return null
    }
  })
  const [error, setError] = useState('')
  const [catalogReady, setCatalogReady] = useState(false)
  const pending = useRef(null)
  const refresh = useCallback(() => {
    if (pending.current) return pending.current
    pending.current = (async () => {
      try {
        const d = await apiRequest('/api/store')
        if (!validCatalog(d))
          throw new Error('The collection could not be updated. Please try again.')
        setData(d)
        setCatalogReady(true)
        try {
          saveCatalog(window.sessionStorage, d)
        } catch {
          /* Browser storage is optional. */
        }
        setError('')
      } catch (e) {
        setError(e.message)
      } finally {
        pending.current = null
      }
    })()
    return pending.current
  }, [])
  useEffect(() => {
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])
  const catalog = data || emptyCatalog
  const value = useMemo(
    () => ({
      ...catalog,
      coupons: Object.fromEntries(
        catalog.coupons.map((c) => [
          c.code,
          { ...c, value: Number(c.value), minCart: Number(c.min_cart) },
        ]),
      ),
      refresh,
      catalogReady,
      catalogPending: !data,
      catalogError: error,
    }),
    [catalog, data, refresh, catalogReady, error],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
export const useStore = () => useContext(StoreContext)
