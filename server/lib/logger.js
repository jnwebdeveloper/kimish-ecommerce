// Structured logs: one JSON object per line on stdout/stderr, which Vercel's log viewer can search
// and filter by field. Never pass request bodies, cookies, tokens or customer details as fields.
const levels = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }

// LOG_LEVEL: debug | info | warn | error | silent. Defaults to info, or warn under `node --test`
// (which sets NODE_TEST_CONTEXT) so test output stays readable.
export function createLogger(env = process.env, base = {}) {
  const threshold =
    levels[env.LOG_LEVEL] ?? (process.env.NODE_TEST_CONTEXT ? levels.warn : levels.info)

  const write = (level, msg, fields = {}) => {
    if (levels[level] < threshold) return
    const entry = { time: new Date().toISOString(), level, msg, ...base, ...fields }
    if (fields.err instanceof Error)
      entry.err = {
        name: fields.err.name,
        message: fields.err.message,
        code: fields.err.code,
        stack: fields.err.stack,
      }
    const line = JSON.stringify(entry)
    if (levels[level] >= levels.warn) console.error(line)
    else console.log(line)
  }

  return {
    debug: (msg, fields) => write('debug', msg, fields),
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
    // Logger that adds fields (e.g. requestId) to every entry
    child: (fields) => createLogger(env, { ...base, ...fields }),
  }
}
