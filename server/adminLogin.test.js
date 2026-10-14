import test from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import { createApi } from './api.js'

// VERCEL makes the API trust x-real-ip, so this test gets its own client address (TEST-NET-3)
// and can't lock out the other tests' logins, which run in parallel from 127.0.0.1
const env = {
  ...loadEnv('development', process.cwd(), ''),
  ...process.env,
  AUTH_ORIGIN: 'http://localhost:5173',
  VERCEL: '1',
}
const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`

test('admin login attempts are limited per client across API instances (PostgreSQL)', async () => {
  // Two separate API instances sharing one database, like two serverless invocations
  const instances = [createApi(env), createApi(env)].map(({ api, pool }) => ({
    pool,
    server: api.listen(0, '127.0.0.1'),
  }))
  await Promise.all(
    instances.map(
      ({ server }) => new Promise((r) => (server.listening ? r() : server.once('listening', r))),
    ),
  )
  const pool = instances[0].pool,
    key = 'admin-login:' + ip
  const login = async (i, password) => {
    const response = await fetch(
      `http://127.0.0.1:${instances[i].server.address().port}/api/admin/login`,
      {
        method: 'POST',
        headers: { Origin: env.AUTH_ORIGIN, 'Content-Type': 'application/json', 'X-Real-IP': ip },
        body: JSON.stringify({ email: env.ADMIN_EMAIL, password }),
      },
    )
    return { status: response.status, cookie: response.headers.get('set-cookie') || '' }
  }
  try {
    await pool.query('DELETE FROM auth_rate_limits WHERE key=$1', [key])
    // 8 failures allowed in the window, counted across both instances
    for (let attempt = 0; attempt < 8; attempt++)
      assert.equal((await login(attempt % 2, 'wrong-password')).status, 401)
    // The 9th is refused even with the right password, on either instance
    assert.equal((await login(0, env.ADMIN_PASSWORD)).status, 429)
    assert.equal((await login(1, 'wrong-password')).status, 429)

    // A successful sign-in clears the count left by earlier failures
    await pool.query('DELETE FROM auth_rate_limits WHERE key=$1', [key])
    assert.equal((await login(0, 'wrong-password')).status, 401)
    assert.equal(
      (await pool.query('SELECT count FROM auth_rate_limits WHERE key=$1', [key])).rows[0].count,
      1,
    )
    const ok = await login(1, env.ADMIN_PASSWORD)
    assert.equal(ok.status, 200)
    assert.equal(
      (await pool.query('SELECT 1 FROM auth_rate_limits WHERE key=$1', [key])).rowCount,
      0,
    )
    // Sign out again so the test leaves no session behind
    const token = ok.cookie.match(/kimish_admin=([^;]+)/)?.[1]
    await fetch(`http://127.0.0.1:${instances[0].server.address().port}/api/admin/logout`, {
      method: 'POST',
      headers: { Origin: env.AUTH_ORIGIN, Cookie: `kimish_admin=${token}` },
    })
  } finally {
    await pool.query('DELETE FROM auth_rate_limits WHERE key=$1', [key])
    for (const { server, pool } of instances) {
      await new Promise((r) => server.close(r))
      await pool.end()
    }
  }
})
