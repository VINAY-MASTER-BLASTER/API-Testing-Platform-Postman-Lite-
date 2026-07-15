/**
 * In-memory rate limiter middleware.
 * 
 * WHY rate limiting on the proxy?
 * - The /api/proxy endpoint makes outbound HTTP requests to arbitrary URLs
 * - Without rate limiting, a malicious or buggy client could use our server as
 *   a DDoS amplifier or exhaust our outbound connections
 * - We use a sliding-window approach: each IP gets a bucket of timestamps,
 *   and we count how many fall within the current window
 * 
 * HOW it works:
 * 1. Track an array of request timestamps per IP address
 * 2. On each request, filter out timestamps older than the window
 * 3. If the count exceeds maxRequests, reject with 429
 * 4. Periodically clean up stale entries to prevent memory leaks
 * 
 * This is NOT persistent — it resets when the server restarts, which is fine
 * for a dev tool (not a production API gateway).
 */

const config = require('../config');

// Map<string, number[]> — IP address → array of request timestamps (ms)
const requestMap = new Map();

// Clean up stale entries every 5 minutes to prevent unbounded memory growth.
// This is important because IPs that made requests hours ago still have entries
// in the map even though all their timestamps have expired.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  const windowMs = config.RATE_LIMIT.windowMs;

  for (const [ip, timestamps] of requestMap.entries()) {
    // Remove timestamps outside the current window
    const valid = timestamps.filter(t => now - t < windowMs);
    if (valid.length === 0) {
      requestMap.delete(ip); // No recent requests — free the memory
    } else {
      requestMap.set(ip, valid);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Rate limiter middleware.
 * Apply this to routes that need throttling (e.g., /api/proxy).
 */
function rateLimiter(req, res, next) {
  const { windowMs, maxRequests } = config.RATE_LIMIT;
  const now = Date.now();

  // Use X-Forwarded-For if behind a reverse proxy, otherwise use the direct IP.
  // For local development this will typically be '::1' or '127.0.0.1'.
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  // Get or create the timestamps array for this IP
  let timestamps = requestMap.get(ip) || [];

  // Filter to only keep timestamps within the current window
  timestamps = timestamps.filter(t => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    // Calculate how many seconds until the oldest request in the window expires,
    // so the client knows when to retry
    const oldestInWindow = timestamps[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      error: {
        message: `Rate limit exceeded. Try again in ${retryAfterSec} seconds.`,
        code: 'RATE_LIMITED',
        retryAfter: retryAfterSec,
      },
    });
  }

  // Record this request's timestamp
  timestamps.push(now);
  requestMap.set(ip, timestamps);

  next();
}

module.exports = rateLimiter;
