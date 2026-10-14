export const loadSettings = async (db) =>
  Object.fromEntries(
    (await db.query('SELECT key,value FROM settings')).rows.map((r) => [r.key, r.value]),
  )

// Shipping methods offered at checkout (settings.shipping_methods, comma separated)
export const shippingMethods = (settings) => {
  const list = String(settings.shipping_methods || 'shiprocket,none,inhouse')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => ['shiprocket', 'none', 'inhouse'].includes(m))
  return list.length ? list : ['inhouse']
}

export async function saveSettings(client, entries) {
  for (const [key, value, description] of entries)
    await client.query(
      'INSERT INTO settings(key,value,description) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',
      [key, value, description],
    )
}
