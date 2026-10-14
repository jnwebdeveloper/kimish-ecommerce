// PostgreSQL constraint errors caused by the submitted data rather than a server fault
const dataConflicts = ['23505', '23503', '23001', '23514', '22P02', '23502']

// Turns thrown errors into JSON responses. Errors from httpError() keep their status and message;
// database conflicts become 400; anything else is a 500 without internal details.
export function errorHandler(err, _req, res, _next) {
  const conflict = dataConflicts.includes(err.code)
  if (!err.status && !conflict) console.error('API error:', err.code || err.name, err.message)
  res.status(err.status || (conflict ? 400 : 500)).json({
    message: err.status
      ? err.message
      : conflict
        ? 'Check the fields. Values must be unique and valid; referenced records cannot be deleted.'
        : 'The database request failed. Please try again.',
    ...err.details,
  })
}
