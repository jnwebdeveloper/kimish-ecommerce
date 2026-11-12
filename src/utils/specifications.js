export function readSpecifications(value) {
  try {
    const rows = typeof value === 'string' ? JSON.parse(value || '[]') : value
    return Array.isArray(rows)
      ? rows.filter((row) => row && typeof row.name === 'string' && typeof row.value === 'string')
      : []
  } catch {
    return []
  }
}
