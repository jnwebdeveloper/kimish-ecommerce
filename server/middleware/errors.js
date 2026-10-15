// PostgreSQL constraint errors caused by the submitted data rather than a server fault
const dataConflicts = ['23505', '23503', '23001', '23514', '22P02', '23502']

// Turns thrown errors into JSON responses. Errors from httpError() keep their status and message;
// database conflicts become 400; anything else is a 500 without internal details, logged with its
// stack and answered with the request id so a report can be matched to the log entry.
export function errorHandler(err, req, res, _next) {
  const conflict = dataConflicts.includes(err.code)
  const status = err.status || (conflict ? 400 : 500)
  // Unexpected errors get their stack logged; deliberate httpError() responses are already
  // covered by the request log line (and any detail the route logged itself)
  if (!err.status && !conflict) req.log.error('request failed', { err })
  else if (conflict) req.log.info('rejected by database constraint', { code: err.code })
  res.status(status).json({
    message: err.status
      ? err.message
      : conflict
        ? 'Check the fields. Values must be unique and valid; referenced records cannot be deleted.'
        : 'The database request failed. Please try again.',
    ...err.details,
    ...(status >= 500 && { requestId: req.id }),
  })
}
