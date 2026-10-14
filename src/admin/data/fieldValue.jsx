// Builds the function that shows a record's value in tables and the details dialog.
// `formatters` lets a page override specific columns (e.g. Products' price and stock).
export function makeFieldValue(moduleMeta, references, formatters = {}) {
  return function fieldValue(row, key) {
    if (formatters[key]) return formatters[key](row)
    const field = moduleMeta?.fields.find((f) => f.name === key)
    if (references[field?.type])
      return (
        references[field.type].find((r) => String(r.id) === String(row[key]))?.name ||
        row[key] ||
        '—'
      )
    if (typeof row[key] === 'boolean')
      return (
        <span className={'admin-badge ' + (row[key] ? 'is-positive' : '')}>
          {row[key] ? (key === 'active' ? 'Published' : 'Yes') : key === 'active' ? 'Draft' : 'No'}
        </span>
      )
    if (['price', 'mrp', 'total', 'min_cart', 'subtotal', 'shipping', 'discount'].includes(key))
      return '₹' + Number(row[key] || 0).toLocaleString('en-IN')
    if (key.endsWith('_at')) return row[key] ? new Date(row[key]).toLocaleString('en-IN') : '—'
    return String(row[key] ?? '—')
  }
}
