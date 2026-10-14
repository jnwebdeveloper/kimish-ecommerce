import { useEffect, useState } from 'react'
import { apiRequest } from '../../data/StoreContext'
import Messages from '../components/Messages'
import { usePageTitle } from '../layout/usePageTitle'
import { useAdminSession } from '../session/AdminSession'

export default function OverviewPage() {
  const { endSession } = useAdminSession()
  const [stats, setStats] = useState({}),
    [error, setError] = useState('')
  usePageTitle('Overview')

  useEffect(() => {
    apiRequest('/api/admin/overview')
      .then(setStats)
      .catch((e) => {
        if (e.status === 401) endSession()
        setError(e.message)
      })
  }, [endSession])

  return (
    <>
      <h2>Overview</h2>
      <Messages error={error} />
      <div className="admin-grid">
        {Object.entries(stats).map(([key, value]) => (
          <div className="stat" key={key}>
            <span>{key.replace('_', ' ')}</span>
            <strong>
              {key === 'revenue' ? '₹' : ''}
              {value}
            </strong>
          </div>
        ))}
      </div>
      <p>
        Changes are saved in PostgreSQL and used by the storefront. Create a product, then add at
        least one variant to publish it in the shop.
      </p>
    </>
  )
}
