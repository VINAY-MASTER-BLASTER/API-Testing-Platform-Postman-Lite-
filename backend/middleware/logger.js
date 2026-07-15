/**
 * Custom request logger middleware (morgan-style).
 * 
 * WHY a custom logger instead of morgan?
 * - Keeps dependencies minimal (hackathon requirement)
 * - We can format output exactly how we want
 * - This is NOT persistent storage — it's purely developer-visibility console output
 * 
 * Logs: METHOD /path → STATUS (response-time-ms)
 * Color-coded by status range for quick scanning in the terminal.
 */

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

/**
 * Picks a color based on HTTP status code range.
 * 2xx = green (success), 3xx = cyan (redirect), 4xx = yellow (client error), 5xx = red (server error)
 */
function colorForStatus(status) {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  if (status >= 200) return colors.green;
  return colors.reset;
}

function loggerMiddleware(req, res, next) {
  const start = Date.now();

  // Hook into the response 'finish' event so we can log *after* the response is sent.
  // This gives us the actual status code and accurate timing.
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = colorForStatus(res.statusCode);
    const timestamp = new Date().toISOString();

    console.log(
      `${colors.dim}[${timestamp}]${colors.reset} ` +
      `${colors.blue}${req.method}${colors.reset} ${req.originalUrl} → ` +
      `${statusColor}${res.statusCode}${colors.reset} ` +
      `${colors.dim}(${duration}ms)${colors.reset}`
    );
  });

  next();
}

module.exports = loggerMiddleware;
