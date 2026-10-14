import test from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import { createApi } from './api.js'
const env = {
  ...loadEnv('development', process.cwd(), ''),
  ...process.env,
  AUTH_ORIGIN: 'http://localhost:5173',
}
// The test signs in as ADMIN_EMAIL and also manages administrators, which only the primary admin may do
env.PRIMARY_ADMIN_EMAIL = env.ADMIN_EMAIL
test('PostgreSQL admin CRUD, public catalogue, checkout stock and authorization', async () => {
  const { api, pool } = createApi(env),
    server = api.listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`
  let cookie = ''
  const created = []
  async function call(path, body, method, auth = true) {
    const response = await fetch(base + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: {
        Origin: env.AUTH_ORIGIN,
        'Content-Type': 'application/json',
        ...(auth ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json()
    return { status: response.status, data, headers: response.headers }
  }
  const add = async (m, body) => {
    const r = await call('/api/admin/' + m, body)
    assert.equal(r.status, 200, JSON.stringify(r))
    created.push([m, r.data.id])
    return r.data.id
  }
  try {
    assert.equal((await call('/api/admin/products', null, null, false)).status, 401)
    assert.equal(
      (await call('/api/admin/login', { email: env.ADMIN_EMAIL, password: 'incorrect' })).status,
      401,
    )
    let result = await call('/api/admin/login', {
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
    })
    assert.equal(result.status, 200)
    cookie = result.headers.get('set-cookie').split(';')[0]
    const category = await add('categories', {
      name: 'QA Category',
      slug: 'qa-category',
      group_id: (await pool.query("SELECT id FROM category_groups WHERE name='Nuts'")).rows[0].id,
      active: true,
    })
    const product = await add('products', {
      name: 'QA Product',
      slug: 'qa-product',
      category_id: category,
      image: '/products/kimish-cashew.png',
      active: true,
      featured: true,
    })
    const variant = await add('variants', {
      product_id: product,
      weight: '100g',
      price: 100,
      mrp: 120,
      stock: 10,
      weight_kg: 0.5,
      length_cm: 20,
      breadth_cm: 20,
      height_cm: 10,
    })
    await add('product_images', {
      product_id: product,
      image: '/products/kimish-cashew.png',
    })
    const customer = await add('customers', {
      name: 'QA Customer',
      phone: '9000000001',
      email: 'qa@example.invalid',
    })
    await add('addresses', {
      customer_id: customer,
      address: 'Test street',
      city: 'Test City',
      state: 'Test State',
      pincode: '123456',
    })
    const records = {
      coupons: {
        code: 'QATEST',
        type: 'fixed',
        value: 10,
        min_cart: 0,
        label: 'QA offer',
        active: true,
      },
      banners: { title: 'QA Banner', placement: 'promotion', link: '/shop', active: true },
      content_sections: { key: 'qa', title: 'QA section', active: true },
      pages: { slug: 'qa-page', title: 'QA page', content: 'QA content', active: true },
      reviews: {
        product_id: product,
        customer_name: 'QA',
        rating: 5,
        content: 'QA review',
        approved: true,
      },
      navigation: {
        label: 'QA',
        url: '/shop',
        location: 'footer',
        menu_type: 'link',
        active: true,
      },
      settings: { key: 'qa_setting', value: 'before' },
      admins: {
        name: 'QA Admin',
        email: 'qa-admin@example.invalid',
        password: 'Test-only-long-password-128!',
      },
    }
    for (const [m, body] of Object.entries(records)) {
      const id = await add(m, body)
      const changed = { ...body }
      const key = ['name', 'title', 'label', 'content', 'value'].find(
        (k) => typeof changed[k] === 'string',
      )
      if (key) changed[key] = 'QA edited'
      if (m === 'admins') delete changed.password
      const update = await call(`/api/admin/${m}/${id}`, changed, 'PUT')
      assert.equal(update.status, 200, JSON.stringify(update))
      assert.ok((await call('/api/admin/' + m)).data.some((row) => row.id === id))
    }
    let store = (await call('/api/store')).data
    assert.ok(store.products.some((p) => p.id === product && p.variants[0].id === variant))
    const order = {
      customer: {
        name: 'QA Customer',
        mobile: '9000000001',
        email: 'qa@example.invalid',
        address: 'Test street',
        city: 'Test City',
        state: 'Test State',
        pincode: '123456',
      },
      payment: 'cod',
      items: [{ variantId: variant, qty: 2 }],
      couponCode: 'QATEST',
    }
    result = await call('/api/orders', order)
    assert.equal(result.status, 201, JSON.stringify(result))
    assert.equal(result.data.total, 269)
    const number = result.data.id
    const orderRow = (await pool.query('SELECT id FROM orders WHERE order_number=$1', [number]))
      .rows[0]
    created.push(['orders', orderRow.id])
    // The admin orders list attaches each order's line items (loaded in one query for all orders)
    const listed = (await call('/api/admin/orders')).data.find((o) => o.id === orderRow.id)
    assert.deepEqual(
      listed.items.map((i) => [i.variant_id, i.quantity]),
      [[variant, 2]],
    )
    assert.equal(
      (await pool.query('SELECT stock FROM variants WHERE id=$1', [variant])).rows[0].stock,
      8,
    )
    assert.equal(
      (await call('/api/track', { orderId: number, mobile: '9000000001' })).data.status,
      'Confirmed',
    )
    assert.equal((await call('/api/track', { orderId: number, mobile: '9000000002' })).status, 404)
    assert.equal(
      (await call('/api/orders', { ...order, items: [{ variantId: variant, qty: 99 }] })).status,
      400,
    )
    assert.equal((await call('/api/orders', { ...order, payment: 'upi' })).status, 400)
    assert.equal(
      (
        await call(
          `/api/admin/orders/${orderRow.id}`,
          {
            status: 'Cancelled',
            payment_status: 'Unpaid',
            tracking_number: '',
            notes: 'QA cancelled',
          },
          'PUT',
        )
      ).status,
      200,
    )
    assert.equal(
      (await pool.query('SELECT stock FROM variants WHERE id=$1', [variant])).rows[0].stock,
      10,
    )
    assert.equal(
      (
        await call(
          `/api/admin/orders/${orderRow.id}`,
          { status: 'Cancelled', payment_status: 'Unpaid', tracking_number: '', notes: '' },
          'PUT',
        )
      ).status,
      200,
    )
    assert.equal(
      (await pool.query('SELECT stock FROM variants WHERE id=$1', [variant])).rows[0].stock,
      10,
    )
    assert.equal((await call(`/api/admin/categories/${category}`, null, 'DELETE')).status, 400)
    // A fresh API pool sees the committed catalogue, proving persistence beyond the request.
    const { pool: secondPool } = createApi(env)
    assert.equal(
      (await secondPool.query('SELECT name FROM products WHERE id=$1', [product])).rows[0].name,
      'QA Product',
    )
    await secondPool.end()
  } finally {
    for (const [m, id] of created.reverse()) await call(`/api/admin/${m}/${id}`, null, 'DELETE')
    await pool.query(
      "DELETE FROM addresses WHERE customer_id IN (SELECT id FROM customers WHERE phone='+919000000001')",
    )
    await pool.query("DELETE FROM customers WHERE phone='+919000000001'")
    await pool.query('DELETE FROM admin_sessions WHERE token_hash IS NOT NULL AND expires_at<now()')
    await new Promise((r) => server.close(r))
    await pool.end()
  }
})
