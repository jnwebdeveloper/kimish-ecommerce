import { useParams } from 'react-router-dom'
import { isMenuModule, moduleFromSlug } from '../data/menu'
import { useAdminSession } from '../session/AdminSession'
import ModulePage from './ModulePage'
import NotFoundPage from './NotFoundPage'

// /admin/:slug for every screen without a dedicated page
export default function ModuleRoute() {
  const { meta } = useAdminSession()
  const module = moduleFromSlug(useParams().slug)
  const metaLoaded = Object.keys(meta).length > 0
  if (
    module === 'overview' ||
    !isMenuModule(module) ||
    (metaLoaded && module !== 'audit' && !meta[module])
  )
    return <NotFoundPage />
  // key: a fresh page (search, dialogs, messages) for each screen
  return <ModulePage key={module} module={module} />
}
