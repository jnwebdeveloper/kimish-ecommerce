import { Link } from 'react-router-dom'
import { usePageTitle } from '../layout/usePageTitle'

export default function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <div className="admin-not-found">
      <h2>Page not found</h2>
      <p>This admin page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link className="btn btn-primary" to="/admin">
        Go to Overview
      </Link>
    </div>
  )
}
