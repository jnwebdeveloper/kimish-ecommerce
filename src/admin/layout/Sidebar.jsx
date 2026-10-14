import { NavLink } from 'react-router-dom'
import { menu, pathFor } from '../data/menu'
import { useAdminSession } from '../session/AdminSession'

// Module links; screens the server doesn't define (not in meta) are hidden
export default function Sidebar() {
  const { meta } = useAdminSession()
  return (
    <nav className="admin-sidebar" aria-label="Admin modules">
      {menu.map((group) => (
        <div className="admin-menu-group" key={group.label}>
          <span>{group.label}</span>
          {group.items
            .filter(([key]) => key === 'overview' || key === 'audit' || meta[key])
            .map(([key, label]) => (
              <NavLink key={key} to={pathFor(key)} end>
                {label}
              </NavLink>
            ))}
        </div>
      ))}
    </nav>
  )
}
