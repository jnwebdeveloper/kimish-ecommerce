import pg from 'pg'
export const createPool = env => new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 })
