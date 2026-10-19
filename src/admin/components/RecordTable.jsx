import { labelFor } from './adminPresentation'

// List of records with View / Edit / Delete actions (Edit and Delete hidden when read-only)
export default function RecordTable({
  rows,
  sort,
  onSort,
  columns,
  moduleMeta,
  valueFor,
  readOnly,
  onView,
  onEdit,
  onDelete,
}) {
  const heading = (key) => (
    <th
      key={key}
      aria-sort={
        sort?.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      {key === 'image' ? (
        labelFor(key, moduleMeta)
      ) : (
        <button className="admin-sort-heading" onClick={() => onSort(key)}>
          {key === 'id' ? 'ID' : labelFor(key, moduleMeta)}{' '}
          <span aria-hidden="true">
            {sort?.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </button>
      )}
    </th>
  )
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {heading('id')}
            {columns.map(heading)}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.id}</td>
              {columns.map((c) => (
                <td key={c}>
                  {c === 'image' ? (
                    row.image ? (
                      <img
                        className="admin-product-thumb"
                        src={row.image}
                        alt={row.name || 'Product'}
                      />
                    ) : (
                      <span>—</span>
                    )
                  ) : (
                    valueFor(row, c)
                  )}
                </td>
              ))}
              <td className="admin-row-actions">
                <button onClick={() => onView(row)}>View</button>
                {!readOnly && (
                  <>
                    <button onClick={() => onEdit(row)}>Edit</button>
                    <button onClick={() => onDelete(row)}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>No matching records.</p>}
    </div>
  )
}
