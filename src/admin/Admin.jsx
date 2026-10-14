import ProductCategoryFields from './ProductCategoryFields'
import ShiprocketPickupPanel from './ShiprocketPickupPanel'
import { categoryPath } from '../data/categoryHierarchy'
import './admin.css'
import { AdminDetails, listColumns, labelFor, sectionFor, singular } from './adminPresentation'
import { useEffect, useRef, useState } from 'react'
import Loading from '../components/Loading'
import { apiRequest } from '../data/StoreContext'
import AdminLayout, { AdminLogin } from './AdminLayout'
import { Link, Navigate, NavLink, useLocation, useParams } from 'react-router-dom'

const menu = [
  { label: 'Dashboard', items: [['overview', 'Overview']] },
  {
    label: 'Catalogue',
    items: [
      ['products', 'Products'],
      ['category_groups', 'Category Groups'],
      ['categories', 'Categories'],
      ['variants', 'Variants & Inventory'],
      ['gift_boxes', 'Customised Gift Boxes'],
    ],
  },
  {
    label: 'Sales & Fulfilment',
    items: [
      ['orders', 'Orders'],
      ['customers', 'Customers'],
      ['addresses', 'Customer Addresses'],
      ['coupons', 'Coupons'],
    ],
  },
  {
    label: 'Website & Content',
    items: [
      ['banners', 'Banners'],
      ['content_sections', 'Homepage Sections'],
      ['pages', 'Pages & Policies'],
      ['navigation', 'Menu Management'],
      ['reviews', 'Product Reviews'],
    ],
  },
  {
    label: 'System',
    items: [
      ['settings', 'Site Settings'],
      ['admins', 'Administrators'],
      ['audit', 'Activity Log'],
    ],
  },
]
const moduleKeys = new Set(menu.flatMap((group) => group.items.map(([key]) => key)))
// Module keys use underscores (gift_boxes); their addresses use hyphens (/admin/gift-boxes). Overview is /admin itself.
const pathFor = (key) => (key === 'overview' ? '/admin' : '/admin/' + key.replaceAll('_', '-'))
// Only return to another admin address after sign-in, never an outside URL
// Other lists each screen needs for dropdowns, names, price/stock columns, galleries and the manual order form
const referencesFor = {
  products: ['categories', 'category_groups', 'variants', 'product_images'],
  categories: ['categories', 'category_groups'],
  variants: ['products'],
  product_images: ['products'],
  reviews: ['products'],
  addresses: ['customers'],
  orders: ['customers', 'products', 'variants'],
}
const referenceKeys = new Set(Object.values(referencesFor).flat())
const safeNext = (next) =>
  next && /^\/admin(\/|\?|$)/.test(next) && !/^\/admin\/login(\/|\?|$)/.test(next) ? next : '/admin'

const blankOrder = () => ({
  customer: {
    name: '',
    mobile: '',
    email: '',
    address: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
  },
  items: [{ variantId: '', qty: 1 }],
  payment: 'cod',
})
export default function Admin() {
  const location = useLocation(),
    parts = (useParams()['*'] || '').split('/').filter(Boolean),
    segment = parts[0] || ''
  const onLogin = segment === 'login' && parts.length === 1
  const requested = segment ? segment.replaceAll('-', '_') : 'overview'
  const knownAddress = parts.length <= 1 && segment !== 'overview' && moduleKeys.has(requested)
  const module = knownAddress ? requested : 'overview'
  const [galleryFiles, setGalleryFiles] = useState([]),
    [galleryProgress, setGalleryProgress] = useState('')
  const [changingPassword, setChangingPassword] = useState(false),
    [currentPassword, setCurrentPassword] = useState(''),
    [newPassword, setNewPassword] = useState('')
  const [admin, setAdmin] = useState(null),
    [loading, setLoading] = useState(true),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  const [meta, setMeta] = useState({}),
    [rows, setRows] = useState([]),
    [stats, setStats] = useState({}),
    [references, setReferences] = useState({}),
    [search, setSearch] = useState(''),
    [editor, setEditor] = useState(null),
    [deleting, setDeleting] = useState(null),
    [details, setDetails] = useState(null),
    [manual, setManual] = useState(null)
  // Lists shared between screens, kept until something is saved (fresh=true) so stock and prices are never stale after an edit
  const cache = useRef({}),
    loadId = useRef(0)
  async function load(fresh = false) {
    if (!admin) return
    const id = ++loadId.current
    setError('')
    if (fresh) cache.current = {}
    const missing = (referencesFor[module] || []).filter(
      (key) => key !== module && !cache.current[key],
    )
    try {
      const [list, overview, ...lists] = await Promise.all([
        module === 'overview' ? null : apiRequest('/api/admin/' + module),
        module === 'overview' ? apiRequest('/api/admin/overview') : null,
        ...missing.map((key) => apiRequest('/api/admin/' + key)),
      ])
      missing.forEach((key, i) => {
        cache.current[key] = lists[i]
      })
      if (list && referenceKeys.has(module)) cache.current[module] = list
      if (id !== loadId.current) return
      if (list) setRows(list)
      if (overview) setStats(overview)
      setReferences({ ...cache.current })
    } catch (e) {
      if (id !== loadId.current) return
      if (e.status === 401) setAdmin(null)
      setError(e.message)
    }
  }
  useEffect(() => {
    apiRequest('/api/admin/session')
      .then((d) => setAdmin(d.admin))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    if (!admin) {
      cache.current = {}
      return
    }
    apiRequest('/api/admin/meta')
      .then(setMeta)
      .catch((e) => {
        if (e.status === 401) setAdmin(null)
        setError(e.message)
      })
  }, [admin])
  useEffect(() => {
    setRows([])
    load()
    setSearch('')
    setEditor(null)
    setDetails(null)
    setDeleting(null)
    if (admin) setNotice('')
    // Runs only when the signed-in admin or the screen changes; load is recreated every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, module])
  const notFound =
    !onLogin &&
    segment !== 'overview' &&
    (!knownAddress ||
      (Object.keys(meta).length > 0 && !['overview', 'audit'].includes(module) && !meta[module]))
  const title = !admin
    ? 'Sign in'
    : notFound
      ? 'Page not found'
      : module === 'overview'
        ? 'Overview'
        : module === 'audit'
          ? 'Activity log'
          : meta[module]?.label || 'Admin'
  useEffect(() => {
    document.title = `${title} · Kimish Admin`
  }, [title])
  // Which dialog is open; the focus trap re-runs when it changes (e.g. Details → Edit) so it targets the new dialog
  const openDialog = editor
    ? 'editor'
    : details
      ? 'details'
      : deleting
        ? 'delete'
        : manual
          ? 'order'
          : changingPassword
            ? 'password'
            : null
  useEffect(() => {
    if (!openDialog) return
    const previous = document.activeElement,
      overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = document.querySelector('.admin-modal')
    const focusable = () => [
      ...(dialog?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
      ) || []),
    ]
    focusable()[0]?.focus()
    const keydown = (e) => {
      if (e.key === 'Escape' && !busy) {
        setEditor(null)
        setDetails(null)
        setDeleting(null)
        setManual(null)
        setChangingPassword(false)
      }
      if (e.key === 'Tab') {
        const items = focusable(),
          first = items[0],
          last = items.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', keydown)
      previous?.focus()
    }
  }, [openDialog, busy])
  async function login(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      setAdmin((await apiRequest('/api/admin/login', { email, password })).admin)
      setPassword('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  async function save(e) {
    e.preventDefault()
    if (module === 'products' && !editor.category_id) {
      setError('Choose a category before saving the product.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await apiRequest(
        `/api/admin/${module}${editor.id ? '/' + editor.id : ''}`,
        editor,
        editor.id ? 'PUT' : 'POST',
      )
      setEditor(null)
      setNotice('Changes saved successfully.')
      await load(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/api/admin/${module}/${deleting.id}`, null, 'DELETE')
      setDeleting(null)
      setNotice('Record deleted.')
      await load(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  async function createOrder(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiRequest('/api/admin/create/order', manual)
      setManual(null)
      setNotice('Order saved and stock updated.')
      await load(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const uploadImage = async (file, field) => {
    if (!file) return
    setError('')
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError('Select a JPG, PNG, WebP or AVIF image smaller than 8 MB.')
      return
    }
    setBusy(true)
    try {
      const signed = await apiRequest('/api/admin/images/presign', {
        filename: file.name,
        type: file.type,
        size: file.size,
      })
      const uploaded = await fetch(signed.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploaded.ok)
        throw new Error('Image upload failed. Check your Cloudflare R2 CORS settings.')
      setEditor((prev) => ({ ...prev, [field]: signed.publicUrl }))
      setNotice('Image uploaded successfully. Save this record to keep it.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const uploadGallery = async () => {
    if (!editor?.id) {
      setError('Save the product before uploading its gallery.')
      return
    }
    if (!galleryFiles.length) {
      setError('Select at least one image.')
      return
    }
    setBusy(true)
    setError('')
    let done = 0
    try {
      for (const file of galleryFiles) {
        if (
          !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) ||
          file.size > 8 * 1024 * 1024
        )
          throw new Error(`${file.name}: choose a JPG, PNG, WebP or AVIF file under 8 MB.`)
        setGalleryProgress(`Uploading ${done + 1} of ${galleryFiles.length}: ${file.name}`)
        const signed = await apiRequest('/api/admin/images/presign', {
          filename: file.name,
          type: file.type,
          size: file.size,
        })
        const uploaded = await fetch(signed.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!uploaded.ok) throw new Error(`${file.name}: upload failed. Check R2 CORS.`)
        await apiRequest(
          '/api/admin/product_images',
          {
            product_id: editor.id,
            image: signed.publicUrl,
            alt: file.name,
            sort_order:
              Math.max(
                -1,
                ...(references.product_images || [])
                  .filter((i) => i.product_id === editor.id)
                  .map((i) => Number(i.sort_order)),
              ) +
              1 +
              done,
          },
          'POST',
        )
        done++
      }
      setGalleryFiles([])
      setGalleryProgress('')
      setNotice(`${done} gallery image(s) saved.`)
      await load(true)
    } catch (e) {
      setError(`${done} image(s) saved. ${e.message}`)
    } finally {
      setBusy(false)
    }
  }
  const openEditor = (row) => {
    setError('')
    setGalleryFiles([])
    setGalleryProgress('')
    setEditor(
      row
        ? { ...row }
        : Object.fromEntries(
            meta[module].fields.map((f) => [
              f.name,
              f.type === 'boolean'
                ? ['active'].includes(f.name)
                : f.options
                  ? f.options[0]
                  : f.type === 'number'
                    ? 0
                    : '',
            ]),
          ),
    )
  }
  if (loading)
    return (
      <main className="admin-boot">
        <Loading message="Loading administration…" />
      </main>
    )
  const here = location.pathname + location.search
  if (!admin && !onLogin)
    return (
      <Navigate
        to={here === '/admin' ? '/admin/login' : '/admin/login?next=' + encodeURIComponent(here)}
        replace
      />
    )
  if (admin && onLogin)
    return <Navigate to={safeNext(new URLSearchParams(location.search).get('next'))} replace />
  if (segment === 'overview' && parts.length === 1) return <Navigate to="/admin" replace />
  if (!admin)
    return (
      <AdminLogin>
        {notice && (
          <p role="status" className="success">
            {notice}
          </p>
        )}
        <form onSubmit={login}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button disabled={busy} className="btn btn-primary full">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </AdminLogin>
    )
  const filtered = rows.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  )
  const columns = listColumns[module] || []
  const groups = menu.map((g) => ({
    ...g,
    items: g.items.filter(([key]) => key === 'overview' || key === 'audit' || meta[key]),
  }))
  const fieldValue = (row, key) => {
    const f = meta[module]?.fields.find((f) => f.name === key)
    if (key === 'price_range' || key === 'inventory') {
      const variants = (references.variants || []).filter(
        (v) => String(v.product_id) === String(row.id),
      )
      return !variants.length
        ? 'No variants'
        : key === 'inventory'
          ? variants.reduce((sum, v) => sum + Number(v.stock), 0) + ' in stock'
          : '₹' +
            Math.min(...variants.map((v) => Number(v.price))).toLocaleString('en-IN') +
            ' onwards'
    }
    if (module === 'products' && key === 'category_id')
      return (
        categoryPath(references.categories || [], row[key])
          .map((c) => c.name)
          .join(' › ') || '—'
      )
    if (references[f?.type])
      return (
        references[f.type].find((r) => String(r.id) === String(row[key]))?.name || row[key] || '—'
      )
    if (key === 'customer_id')
      return (
        row.customer_snapshot?.name ||
        references.customers?.find((r) => r.id === row[key])?.name ||
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
  const moduleHelp =
    module === 'navigation'
      ? 'Manage additional header and footer links: choose the label, destination, display order and whether to open in a new tab. Collection menus are managed through Categories.'
      : module === 'admins'
        ? 'Manage staff accounts that can sign in to the back office and edit store data. Only the primary administrator can manage these accounts and view the activity log. These are not customer accounts.'
        : module === 'products'
          ? 'Manage product information and photos here. Set pack sizes, prices and stock in Variants & Inventory.'
          : module === 'gift_boxes'
            ? 'Manage gift box contents, pricing, inventory and shipping information.'
            : ''
  const formSections = Object.entries(
    (meta[module]?.fields || [])
      .filter(
        (f) =>
          f.name !== 'slug' &&
          !(module === 'navigation' && ['parent_id', 'menu_type'].includes(f.name)),
      )
      .reduce((groups, f) => {
        const key = sectionFor(f)
        ;(groups[key] ||= []).push(f)
        return groups
      }, {}),
  )

  const sidebar = (
    <nav className="admin-sidebar" aria-label="Admin modules">
      {groups.map((group) => (
        <div className="admin-menu-group" key={group.label}>
          <span>{group.label}</span>
          {group.items.map(([key, label]) => (
            <NavLink key={key} to={pathFor(key)} end>
              {label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
  return (
    <AdminLayout
      admin={admin}
      sidebar={sidebar}
      onChangePassword={() => setChangingPassword(true)}
      onSignOut={async () => {
        await apiRequest('/api/admin/logout', {})
        setAdmin(null)
      }}
    >
      {notFound ? (
        <div className="admin-not-found">
          <h2>Page not found</h2>
          <p>This admin page doesn&apos;t exist, or you don&apos;t have access to it.</p>
          <Link className="btn btn-primary" to="/admin">
            Go to Overview
          </Link>
        </div>
      ) : (
        <>
          <h2>{title}</h2>
          {moduleHelp && <p className="admin-module-help">{moduleHelp}</p>}
          {module === 'settings' && <ShiprocketPickupPanel />}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="success">
              {notice}
            </p>
          )}
          {module === 'overview' ? (
            <>
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
                Changes are saved in PostgreSQL and used by the storefront. Create a product, then
                add at least one variant to publish it in the shop.
              </p>
            </>
          ) : (
            <>
              <div className="admin-toolbar">
                <input
                  aria-label="Search records"
                  placeholder="Search records…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {module !== 'audit' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => (module === 'orders' ? setManual(blankOrder()) : openEditor())}
                  >
                    Add {singular[module] || 'record'}
                  </button>
                )}
                <button className="btn btn-outline" onClick={() => load(true)}>
                  Refresh
                </button>
              </div>
              <p>{filtered.length} records</p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      {columns.map((c) => (
                        <th key={c}>{labelFor(c, meta[module])}</th>
                      ))}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
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
                              fieldValue(row, c)
                            )}
                          </td>
                        ))}
                        {
                          <td className="admin-row-actions">
                            <button onClick={() => setDetails(row)}>View</button>
                            {module !== 'audit' && (
                              <>
                                <button onClick={() => openEditor(row)}>Edit</button>
                                <button onClick={() => setDeleting(row)}>Delete</button>
                              </>
                            )}
                          </td>
                        }
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && <p>No matching records.</p>}
              </div>
            </>
          )}
        </>
      )}
      {changingPassword && (
        <div className="admin-modal-backdrop">
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Change administrator password"
          >
            <h2>Change password</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setError('')
                setBusy(true)
                try {
                  await apiRequest('/api/admin/change-password', { currentPassword, newPassword })
                  setChangingPassword(false)
                  setAdmin(null)
                  setCurrentPassword('')
                  setNewPassword('')
                  setNotice('Password changed. Please sign in again.')
                } catch (err) {
                  setError(err.message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label>
                New password (at least 12 characters)
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength="12"
                  maxLength="128"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="admin-modal-actions">
                <button disabled={busy} className="btn btn-primary">
                  Update password
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setChangingPassword(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {editor && (
        <div className="admin-modal-backdrop">
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
          >
            <div className="admin-dialog-heading">
              <div>
                <span className="eyebrow">{meta[module].label}</span>
                <h2 id="editor-title">
                  {editor.id ? 'Edit' : 'Add'} {singular[module] || 'record'}
                </h2>
                <p>Required fields are marked *.</p>
              </div>
              <button
                type="button"
                className="admin-close"
                disabled={busy}
                aria-label="Close editor"
                onClick={() => setEditor(null)}
              >
                ×
              </button>
            </div>
            <form onSubmit={save}>
              {formSections.map(([title, fields]) => (
                <fieldset className="admin-form-section" key={title}>
                  <legend>{title}</legend>
                  <div className="admin-form-grid">
                    {fields.map((f) =>
                      module === 'products' && f.name === 'category_id' ? (
                        <ProductCategoryFields
                          key={f.name}
                          categories={references.categories}
                          groups={references.category_groups}
                          value={editor.category_id}
                          onChange={(value) =>
                            setEditor((prev) => ({ ...prev, category_id: value }))
                          }
                        />
                      ) : (
                        <label
                          className={
                            ['content', 'body', 'seo_description'].includes(f.name)
                              ? 'admin-field-wide'
                              : f.type === 'boolean'
                                ? 'admin-toggle'
                                : ''
                          }
                          key={f.name}
                        >
                          {f.label}
                          {f.required ? ' *' : ''}
                          {f.type === 'boolean' ? (
                            <input
                              type="checkbox"
                              checked={!!editor[f.name]}
                              onChange={(e) => setEditor({ ...editor, [f.name]: e.target.checked })}
                            />
                          ) : f.type === 'textarea' ? (
                            <textarea
                              value={editor[f.name] || ''}
                              required={f.required}
                              onChange={(e) => setEditor({ ...editor, [f.name]: e.target.value })}
                            />
                          ) : f.type === 'select' || references[f.type] ? (
                            <select
                              required={f.required}
                              value={editor[f.name] ?? ''}
                              onChange={(e) => setEditor({ ...editor, [f.name]: e.target.value })}
                            >
                              <option value="">Select…</option>
                              {(
                                f.options ||
                                references[f.type].map((r) => ({
                                  id: r.id,
                                  label: r.name || r.phone,
                                }))
                              ).map((o) => (
                                <option key={o.id || o} value={o.id || o}>
                                  {o.label || o}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={
                                f.type === 'number'
                                  ? 'number'
                                  : f.type === 'password'
                                    ? 'password'
                                    : f.type === 'email'
                                      ? 'email'
                                      : 'text'
                              }
                              min={f.type === 'number' ? 0 : undefined}
                              step={f.type === 'number' ? 'any' : undefined}
                              value={editor[f.name] ?? ''}
                              required={f.required}
                              onChange={(e) => setEditor({ ...editor, [f.name]: e.target.value })}
                            />
                          )}
                          {['image'].includes(f.name) && (
                            <>
                              <input
                                aria-label={`Upload ${f.label}`}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/avif"
                                onChange={(e) => uploadImage(e.target.files?.[0], f.name)}
                              />
                              <small>
                                Choose a JPG, PNG, WebP or AVIF image up to 8 MB, or paste an image
                                link.
                              </small>
                              {editor[f.name] && (
                                <img
                                  src={editor[f.name]}
                                  alt="Image preview"
                                  style={{ width: 110, height: 110, objectFit: 'contain' }}
                                />
                              )}
                            </>
                          )}
                        </label>
                      ),
                    )}
                  </div>
                </fieldset>
              ))}
              {module === 'products' && (
                <div className="admin-gallery-upload">
                  <h3>Product gallery</h3>
                  <p>Additional photos shown alongside the primary product image.</p>
                  <div className="admin-gallery-grid">
                    {(references.product_images || [])
                      .filter((i) => i.product_id === editor.id)
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((i) => (
                        <div key={i.id}>
                          <img src={i.image} alt={i.alt || 'Product photo'} />
                          <label>
                            Image description
                            <input
                              value={i.alt || ''}
                              onChange={(e) =>
                                setReferences((prev) => ({
                                  ...prev,
                                  product_images: prev.product_images.map((item) =>
                                    item.id === i.id ? { ...item, alt: e.target.value } : item,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label>
                            Display order
                            <input
                              type="number"
                              min="0"
                              value={i.sort_order}
                              onChange={(e) =>
                                setReferences((prev) => ({
                                  ...prev,
                                  product_images: prev.product_images.map((item) =>
                                    item.id === i.id
                                      ? { ...item, sort_order: Number(e.target.value) }
                                      : item,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true)
                              try {
                                await apiRequest('/api/admin/product_images/' + i.id, i, 'PUT')
                                setNotice('Gallery photo updated.')
                                await load(true)
                              } catch (e) {
                                setError(e.message)
                              } finally {
                                setBusy(false)
                              }
                            }}
                          >
                            Save photo
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true)
                              try {
                                await apiRequest(
                                  '/api/admin/product_images/' + i.id,
                                  null,
                                  'DELETE',
                                )
                                await load(true)
                              } catch (e) {
                                setError(e.message)
                              } finally {
                                setBusy(false)
                              }
                            }}
                          >
                            Remove photo
                          </button>
                        </div>
                      ))}
                  </div>
                  <input
                    aria-label="Choose multiple gallery images"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={(e) => setGalleryFiles([...e.target.files])}
                  />
                  <p>
                    {galleryFiles.length} image(s) selected. Save the product first, then upload the
                    gallery.
                  </p>
                  {galleryProgress && <p role="status">{galleryProgress}</p>}
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={busy || !editor.id || !galleryFiles.length}
                    onClick={uploadGallery}
                  >
                    Upload all gallery images
                  </button>
                </div>
              )}
              {notice && (
                <p role="status" className="success">
                  {notice}
                </p>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <div className="admin-modal-actions">
                <button disabled={busy} className="btn btn-primary">
                  Save changes
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="btn btn-outline"
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {deleting && (
        <div className="admin-modal-backdrop">
          <section className="admin-modal" role="dialog" aria-modal="true">
            <h2>Delete this record?</h2>
            <p>{deleting.name || deleting.title || deleting.order_number || deleting.id}</p>
            <p>This removes it from the database. Related records may prevent deletion.</p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button disabled={busy} className="btn btn-primary" onClick={remove}>
              Confirm delete
            </button>{' '}
            <button className="btn btn-outline" onClick={() => setDeleting(null)}>
              Cancel
            </button>
          </section>
        </div>
      )}
      {details && (
        <div className="admin-modal-backdrop">
          <section
            className="admin-modal admin-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Record details"
          >
            <div className="admin-dialog-heading">
              <div>
                <span className="eyebrow">
                  {meta[module]?.label || 'Activity log'} · #{details.id}
                </span>
                <h2>
                  {details.name ||
                    details.title ||
                    details.order_number ||
                    details.label ||
                    details.code ||
                    'Record details'}
                </h2>
              </div>
              <button
                className="admin-close"
                aria-label="Close details"
                onClick={() => setDetails(null)}
              >
                ×
              </button>
            </div>
            <AdminDetails
              row={details}
              module={module}
              meta={meta[module]}
              references={references}
              valueFor={fieldValue}
            />
            <div className="admin-modal-actions">
              <button className="btn btn-outline" onClick={() => setDetails(null)}>
                Close
              </button>
              {module !== 'audit' && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    openEditor(details)
                    setDetails(null)
                  }}
                >
                  Edit {singular[module] || 'record'}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {manual && (
        <div className="admin-modal-backdrop">
          <section className="admin-modal" role="dialog" aria-modal="true">
            <h2>Create order</h2>
            <form onSubmit={createOrder}>
              <div className="admin-form-grid">
                {Object.keys(manual.customer).map((key) => (
                  <label key={key}>
                    {key}
                    <input
                      required={!['email', 'landmark'].includes(key)}
                      value={manual.customer[key]}
                      onChange={(e) =>
                        setManual({
                          ...manual,
                          customer: { ...manual.customer, [key]: e.target.value },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <h3>Order items</h3>
              {manual.items.map((item, index) => (
                <div className="admin-toolbar" key={index}>
                  <select
                    aria-label={`Variant ${index + 1}`}
                    required
                    value={item.variantId}
                    onChange={(e) =>
                      setManual({
                        ...manual,
                        items: manual.items.map((i, n) =>
                          n === index ? { ...i, variantId: e.target.value } : i,
                        ),
                      })
                    }
                  >
                    <option value="">Select product / pack</option>
                    {references.variants?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {references.products?.find((p) => p.id === v.product_id)?.name} · {v.weight}{' '}
                        · ₹{v.price} · Stock {v.stock}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Quantity ${index + 1}`}
                    type="number"
                    min="1"
                    max="100"
                    value={item.qty}
                    onChange={(e) =>
                      setManual({
                        ...manual,
                        items: manual.items.map((i, n) =>
                          n === index ? { ...i, qty: Number(e.target.value) } : i,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    disabled={manual.items.length === 1}
                    onClick={() =>
                      setManual({ ...manual, items: manual.items.filter((_, n) => n !== index) })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  setManual({ ...manual, items: [...manual.items, { variantId: '', qty: 1 }] })
                }
              >
                Add item
              </button>
              <p>
                Prices, shipping and stock are calculated by the server. New orders use Cash on
                Delivery.
              </p>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button disabled={busy} className="btn btn-primary">
                Create order
              </button>{' '}
              <button type="button" className="btn btn-outline" onClick={() => setManual(null)}>
                Cancel
              </button>
            </form>
          </section>
        </div>
      )}
    </AdminLayout>
  )
}
