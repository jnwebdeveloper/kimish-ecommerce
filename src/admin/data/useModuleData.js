import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../data/StoreContext'
import { useAdminSession } from '../session/AdminSession'
import { referenceKeys, referencesFor } from './menu'

// Loads a screen's list together with only the reference lists it uses. Reference lists are cached
// across screens until something is saved (reload clears the cache), so stock and prices are never
// stale after an edit.
export function useModuleData(module) {
  const { cache, endSession } = useAdminSession()
  const [rows, setRows] = useState([]),
    [references, setReferences] = useState({}),
    [error, setError] = useState('')
  const loadId = useRef(0)

  const load = useCallback(
    async (fresh = false) => {
      const id = ++loadId.current
      setError('')
      if (fresh) cache.current = {}
      const missing = (referencesFor[module] || []).filter(
        (key) => key !== module && !cache.current[key],
      )
      try {
        const [list, ...lists] = await Promise.all([
          apiRequest('/api/admin/' + module),
          ...missing.map((key) => apiRequest('/api/admin/' + key)),
        ])
        missing.forEach((key, i) => {
          cache.current[key] = lists[i]
        })
        if (referenceKeys.has(module)) cache.current[module] = list
        // Ignore replies for a screen the admin has already left
        if (id !== loadId.current) return
        setRows(list)
        setReferences({ ...cache.current })
      } catch (e) {
        if (id !== loadId.current) return
        if (e.status === 401) endSession()
        setError(e.message)
      }
    },
    [module, cache, endSession],
  )

  useEffect(() => {
    load()
  }, [load])

  const reload = useCallback(() => load(true), [load])
  return { rows, references, error, reload }
}
