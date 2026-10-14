// Fixed-window counters in PostgreSQL (auth_rate_limits, from migrations/20261014_otp_store.sql),
// shared by every server instance — in-memory counters don't hold on serverless hosts like Vercel.

// Counts one hit for key and returns the count in the current window
export async function hitRateLimit(pool, key, windowMs) {
  const { rows } = await pool.query(
    `INSERT INTO auth_rate_limits(key,count,expires_at) VALUES($1,1,now()+$2*interval '1 millisecond')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_rate_limits.expires_at<=now() THEN 1 ELSE auth_rate_limits.count+1 END,
    expires_at=CASE WHEN auth_rate_limits.expires_at<=now() THEN EXCLUDED.expires_at ELSE auth_rate_limits.expires_at END RETURNING count`,
    [key, windowMs],
  )
  return rows[0].count
}

export const clearRateLimit = (pool, key) =>
  pool.query('DELETE FROM auth_rate_limits WHERE key=$1', [key])
