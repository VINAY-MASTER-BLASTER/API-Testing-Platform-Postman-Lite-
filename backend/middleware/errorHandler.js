/**
 * Centralized error-handling middleware.
 * 
 * WHY a single error handler?
 * - Express treats any middleware with 4 parameters (err, req, res, next) as an error handler
 * - By placing this LAST in the middleware chain, it catches any errors thrown or
 *   passed via next(err) from any route or middleware
 * - This ensures consistent error shapes across the entire API — the frontend always
 *   gets { error: { message, code } } and never a raw stack trace
 * 
 * IMPORTANT: This must be registered AFTER all routes in app.js:
 *   app.use(routes);
 *   app.use(errorHandler);  // <-- last
 */

function errorHandler(err, req, res, next) {
  // Log the full error server-side for debugging (developers need the stack trace,
  // but clients should never see it)
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // If the error has a status code attached (e.g., from a controller doing
  // const err = new Error('Not found'); err.status = 404; throw err;),
  // use that. Otherwise default to 500.
  const statusCode = err.status || err.statusCode || 500;

  // Map common error types to user-friendly codes
  let code = 'INTERNAL_ERROR';
  if (statusCode === 400) code = 'BAD_REQUEST';
  if (statusCode === 404) code = 'NOT_FOUND';
  if (statusCode === 409) code = 'CONFLICT';
  if (statusCode === 429) code = 'RATE_LIMITED';
  if (err.code) code = err.code; // Allow controllers to set custom codes

  res.status(statusCode).json({
    error: {
      message: err.message || 'An unexpected error occurred',
      code,
    },
  });
}

module.exports = errorHandler;
