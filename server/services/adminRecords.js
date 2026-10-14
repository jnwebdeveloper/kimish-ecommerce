import { httpError, withTransaction } from '../lib/http.js'
import { modules, validate } from '../modules.js'
import { passwordHash } from '../password.js'
import { automaticSlug } from '../slugs.js'
import { audit } from './audit.js'
import { restoreStock } from './orders.js'

// Table names below always come from the modules.js definitions, never from request input
const requireModule = (module) => {
  if (!modules[module]) throw httpError(404, 'Not found.')
}
const validated = (module, body, creating) => {
  try {
    return validate(module, body, creating)
  } catch (e) {
    throw httpError(400, e.message)
  }
}

export async function listRecords(pool, module) {
  requireModule(module)
  const columns = module === 'admins' ? 'id,name,email,created_at' : '*'
  const rows = (await pool.query(`SELECT ${columns} FROM ${module} ORDER BY id DESC LIMIT 1000`))
    .rows
  if (module === 'orders') {
    // Attach every order's line items with one query
    const items = (
        await pool.query('SELECT * FROM order_items WHERE order_id=ANY($1::int[]) ORDER BY id', [
          rows.map((r) => r.id),
        ])
      ).rows,
      byOrder = new Map(rows.map((r) => [r.id, []]))
    for (const item of items) byOrder.get(item.order_id)?.push(item)
    for (const row of rows) row.items = byOrder.get(row.id)
  }
  return rows
}

// Categories: resolve the group name, and keep the tree to three levels without cycles
async function checkCategory(pool, values, id) {
  if (values.group_id) {
    const group = (
      await pool.query('SELECT name FROM category_groups WHERE id=$1 AND active=true', [
        values.group_id,
      ])
    ).rows[0]
    if (!group) throw httpError(400, 'Select a valid active category group.')
    values.group_name = group.name
  }
  if (!values.parent_id) return
  if (Number(values.parent_id) === Number(id))
    throw httpError(400, 'A category cannot be its own parent.')
  const ancestors = (
    await pool.query(
      'WITH RECURSIVE ancestors AS (SELECT id,parent_id,1 AS depth FROM categories WHERE id=$1 UNION ALL SELECT c.id,c.parent_id,a.depth+1 FROM categories c JOIN ancestors a ON c.id=a.parent_id WHERE a.depth<4) SELECT id,depth FROM ancestors',
      [values.parent_id],
    )
  ).rows
  if (!ancestors.length) throw httpError(400, 'Select an existing parent category.')
  if (ancestors.some((r) => Number(r.id) === Number(id)))
    throw httpError(400, 'A category cannot be moved beneath one of its descendants.')
  if (ancestors.length >= 3) throw httpError(400, 'Only three category levels are supported.')
  const depth =
    (
      await pool.query(
        'WITH RECURSIVE descendants AS (SELECT id,1 AS depth FROM categories WHERE id=$1 UNION ALL SELECT c.id,d.depth+1 FROM categories c JOIN descendants d ON c.parent_id=d.id WHERE d.depth<4) SELECT max(depth) AS depth FROM descendants',
        [id || 0],
      )
    ).rows[0]?.depth || 1
  if (ancestors.length + Number(depth) > 3)
    throw httpError(400, 'This change would exceed the three-level category limit.')
}

// Creates (no id) or updates a record; returns { id }
export async function saveRecord(pool, admin, module, id, input) {
  if (!modules[module] || module === 'orders')
    throw httpError(400, 'Use the order form to create orders.')
  const body = { ...input }
  // Keep an existing URL slug when editing; generate one from the name when creating
  if (modules[module].fields.some((f) => f.name === 'slug') && !body.slug) {
    if (id) {
      const existing = (await pool.query(`SELECT slug FROM ${module} WHERE id=$1`, [id])).rows[0]
      if (!existing) throw httpError(404, 'Not found.')
      body.slug = existing.slug
    } else body.slug = automaticSlug(body.name || body.title)
  }
  const values = validated(module, body, !id)
  if (module === 'categories') await checkCategory(pool, values, id)
  if (module === 'admins' && values.password) {
    values.password_hash = passwordHash(values.password)
    delete values.password
  }
  return withTransaction(pool, async (client) => {
    const keys = Object.keys(values)
    const row = id
      ? (
          await client.query(
            `UPDATE ${module} SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')} WHERE id=$${keys.length + 1} RETURNING id`,
            [...Object.values(values), id],
          )
        ).rows[0]
      : (
          await client.query(
            `INSERT INTO ${module}(${keys.join(',')}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`,
            Object.values(values),
          )
        ).rows[0]
    if (!row) throw httpError(404, 'Not found.')
    // A new password signs that administrator out everywhere
    if (module === 'admins' && values.password_hash)
      await client.query('DELETE FROM admin_sessions WHERE admin_id=$1', [row.id])
    await audit(client, admin, id ? 'update' : 'create', module, row.id)
    return row
  })
}

export async function deleteRecord(pool, admin, module, id) {
  requireModule(module)
  if (module === 'admins' && id === admin.id)
    throw httpError(400, 'You cannot delete your own administrator account.')
  await withTransaction(pool, async (c) => {
    if (module === 'orders') {
      // Deleting an order that hasn't been delivered or cancelled puts its stock back
      const row = (await c.query('SELECT status FROM orders WHERE id=$1 FOR UPDATE', [id])).rows[0]
      if (row && !['Cancelled', 'Delivered'].includes(row.status)) await restoreStock(c, id)
    }
    const result = await c.query(`DELETE FROM ${module} WHERE id=$1`, [id])
    if (!result.rowCount) throw httpError(404, 'Not found.')
    await audit(c, admin, 'delete', module, id)
  })
}

// Status, payment, tracking and notes; cancelling restores stock once, and cancelled orders stay cancelled
export async function updateOrder(pool, admin, id, input) {
  const v = validated('orders', input, false)
  return withTransaction(pool, async (c) => {
    const old = (await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id])).rows[0]
    if (!old) throw httpError(404, 'Not found.')
    if (old.status === 'Cancelled' && v.status !== 'Cancelled')
      throw httpError(400, 'Cancelled orders cannot be reopened. Create a new order.')
    if (v.status === 'Cancelled' && old.status !== 'Cancelled') await restoreStock(c, old.id)
    await c.query(
      'UPDATE orders SET status=$1,payment_status=$2,tracking_number=$3,notes=$4 WHERE id=$5',
      [v.status, v.payment_status, v.tracking_number, v.notes, old.id],
    )
    await audit(c, admin, 'update', 'orders', old.id)
    return { id: old.id }
  })
}
