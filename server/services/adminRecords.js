import { httpError, withTransaction } from '../lib/http.js'
import { modules, validate } from '../modules.js'
import { passwordHash } from '../password.js'
import { automaticSlug } from '../slugs.js'
import { audit } from './audit.js'
import { MEDIA_FOLDERS, MEDIA_TYPES } from '../../src/utils/media.js'
import {
  claimNewUploads,
  deleteUnusedMedia,
  galleryInput,
  removeQuietly,
  storageOf,
} from './media.js'
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
  if (module === 'products') {
    // Each product's gallery (main image first), ordered for display
    const media = (
        await pool.query(
          'SELECT * FROM product_media WHERE product_id=ANY($1::int[]) ORDER BY sort_order,id',
          [rows.map((r) => r.id)],
        )
      ).rows,
      byProduct = new Map(rows.map((r) => [r.id, []]))
    for (const item of media) byProduct.get(item.product_id)?.push(item)
    for (const row of rows) row.images = byProduct.get(row.id)
  }
  return rows
}

// Replaces a product's gallery: the main image first (sort_order 0), then the others in order,
// skipping repeated URLs. Each row records which storage holds its file (NULL for external links).
// Returns the rows that were dropped, so their files can be deleted after the save commits.
async function replaceGallery(client, storage, productId, mainUrl, gallery, productName) {
  const previous = (
    await client.query(
      'DELETE FROM product_media WHERE product_id=$1 RETURNING media_url,storage_number,storage_key',
      [productId],
    )
  ).rows
  const seen = new Set()
  const rows = []
  if (mainUrl) {
    const own = gallery.find((g) => g.media_url === mainUrl)
    rows.push({
      media_url: mainUrl,
      alt_text: own?.alt_text || productName,
      media_type: MEDIA_TYPES.IMAGE,
    })
  }
  rows.push(...gallery)
  let order = 0
  for (const item of rows) {
    if (seen.has(item.media_url)) continue
    seen.add(item.media_url)
    const place = storageOf(storage, item.media_url)
    await client.query(
      'INSERT INTO product_media(product_id,media_url,alt_text,media_type,sort_order,storage_number,storage_key) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        productId,
        item.media_url,
        item.alt_text,
        item.media_type,
        order++,
        place.storage_number,
        place.storage_key,
      ],
    )
  }
  return previous.filter((row) => !seen.has(row.media_url))
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
// storage (optional) renames files uploaded before the record had an ID; see claimNewUploads.
// For products, input.images (when sent) replaces the gallery in the same transaction.
export async function saveRecord(pool, admin, module, id, input, storage, log) {
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
  const gallery = module === 'products' ? galleryInput(input.images) : undefined
  // The main image comes first in the product's media list, so it must be a photo
  if (gallery?.length && !values.media_url)
    throw httpError(
      400,
      'The first item in Photos & videos must be a photo. Add a photo before saving.',
    )
  if (module === 'categories') await checkCategory(pool, values, id)
  if (module === 'admins' && values.password) {
    values.password_hash = passwordHash(values.password)
    delete values.password
  }
  // Storage objects copied during this save, the new-… originals they replace, and gallery files
  // the save dropped (deleted once nothing else uses them)
  const tracker = { copied: [], originals: [], dropped: [] }
  let row
  try {
    row = await withTransaction(pool, async (client) => {
      const saved = await writeRecord(client, admin, module, id, values)
      await attachMedia(client, storage, module, saved.id, values, gallery, tracker)
      return saved
    })
  } catch (err) {
    await removeQuietly(storage, tracker.copied, log)
    throw err
  }
  await removeQuietly(storage, tracker.originals, log)
  if (tracker.dropped.length) await deleteUnusedMedia(pool, storage, tracker.dropped, log)
  return row
}

// Renames new-… uploads now that the record has an ID, and saves a product's gallery
async function attachMedia(client, storage, module, id, values, gallery, tracker) {
  const folder = MEDIA_FOLDERS[module]
  const fields = ['image', 'media_url'].filter((name) => values[name])
  if (folder) {
    const urls = [...fields.map((name) => values[name]), ...(gallery || []).map((g) => g.media_url)]
    const renamed = await claimNewUploads(storage, folder, id, urls, tracker)
    for (const name of fields)
      if (renamed.has(values[name])) {
        values[name] = renamed.get(values[name])
        await client.query(`UPDATE ${module} SET ${name}=$1 WHERE id=$2`, [values[name], id])
      }
    for (const item of gallery || []) item.media_url = renamed.get(item.media_url) || item.media_url
  }
  if (module === 'products' && gallery)
    tracker.dropped.push(
      ...(await replaceGallery(client, storage, id, values.media_url, gallery, values.name)),
    )
}

async function writeRecord(client, admin, module, id, values) {
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
}

// Deleting a product also deletes its media files from storage, unless another record uses them
export async function deleteRecord(pool, admin, module, id, storage, log) {
  requireModule(module)
  if (module === 'admins' && id === admin.id)
    throw httpError(400, 'You cannot delete your own administrator account.')
  let media = []
  await withTransaction(pool, async (c) => {
    if (module === 'products')
      media = (
        await c.query(
          'SELECT media_url,storage_number,storage_key FROM product_media WHERE product_id=$1',
          [id],
        )
      ).rows
    if (module === 'orders') {
      // Deleting an order that hasn't been delivered or cancelled puts its stock back
      const row = (await c.query('SELECT status FROM orders WHERE id=$1 FOR UPDATE', [id])).rows[0]
      if (row && !['Cancelled', 'Delivered'].includes(row.status)) await restoreStock(c, id)
    }
    const result = await c.query(`DELETE FROM ${module} WHERE id=$1`, [id])
    if (!result.rowCount) throw httpError(404, 'Not found.')
    await audit(c, admin, 'delete', module, id)
  })
  if (media.length && storage) await deleteUnusedMedia(pool, storage, media, log)
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
