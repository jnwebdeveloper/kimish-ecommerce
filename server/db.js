import pg from 'pg'
// Serverless instances each hold their own pool, so keep it small on Vercel (use Neon's pooled connection string there)
export const createPool = (env) =>
  new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: Number(env.PG_POOL_MAX || (env.VERCEL ? 3 : 10)),
  })
