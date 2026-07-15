/**
 * Proxy Controller — handles the core request-forwarding logic.
 * 
 * This is the most important controller in the app. It receives a request
 * configuration from the frontend, delegates to the httpClient to make the
 * actual outbound HTTP call, and returns the normalized response.
 * 
 * FLOW:
 *   1. Validate incoming config (method + url required)
 *   2. Resolve any environment variables in the URL/headers/body
 *   3. Apply auth settings (Bearer, Basic, API Key)
 *   4. Delegate to httpClient.executeRequest()
 *   5. Return normalized response or error
 */

const { executeRequest } = require('../services/httpClient');
const { formatSuccess, formatError } = require('../utils/responseFormatter');

/**
 * POST /api/proxy
 * 
 * Expects JSON body:
 * {
 *   method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "QUERY",
 *   url: "https://api.example.com/data",
 *   headers: { "Content-Type": "application/json" },
 *   body: "..." or { key: "value" },
 *   auth: { type: "bearer", token: "..." } | { type: "basic", username: "...", password: "..." } | ...,
 *   params: [{ key: "...", value: "...", enabled: true }],
 *   environment: { BASE_URL: "https://...", TOKEN: "..." }  // resolved variables
 * }
 */
async function proxyRequest(req, res, next) {
  try {
    let { method, url, headers = {}, body, auth, params, environment } = req.body;

    // --- 1. Basic validation ---
    if (!method || !url) {
      return res.status(400).json({
        error: {
          message: 'Both "method" and "url" are required',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    // --- 2. Resolve environment variables ({{VARIABLE}} syntax) ---
    if (environment && typeof environment === 'object') {
      url = interpolateVariables(url, environment);
      
      // Also interpolate headers
      for (const [key, value] of Object.entries(headers)) {
        headers[key] = interpolateVariables(String(value), environment);
      }

      // Also interpolate body if it's a string
      if (typeof body === 'string') {
        body = interpolateVariables(body, environment);
      }
    }

    // --- 3. Apply query parameters ---
    if (params && Array.isArray(params)) {
      const urlObj = new URL(url);
      for (const param of params) {
        if (param.enabled !== false && param.key) {
          urlObj.searchParams.set(param.key, param.value || '');
        }
      }
      url = urlObj.toString();
    }

    // --- 4. Apply authentication ---
    if (auth && auth.type) {
      switch (auth.type) {
        case 'bearer':
          // Bearer Token → auto-inject Authorization header
          if (auth.token) {
            headers['Authorization'] = `Bearer ${auth.token}`;
          }
          break;

        case 'basic':
          // Basic Auth → Base64 encode username:password
          if (auth.username !== undefined) {
            const credentials = Buffer.from(`${auth.username}:${auth.password || ''}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;

        case 'apikey':
          // API Key → inject as header or query param
          if (auth.key && auth.value) {
            if (auth.addTo === 'query') {
              // Add to URL as query parameter
              const urlObj = new URL(url);
              urlObj.searchParams.set(auth.key, auth.value);
              url = urlObj.toString();
            } else {
              // Default: add as header
              headers[auth.key] = auth.value;
            }
          }
          break;

        // 'none' or unrecognized — no auth applied
        default:
          break;
      }
    }

    // --- 5. Execute the request via httpClient ---
    const response = await executeRequest({ method, url, headers, body });

    // --- 6. Return the normalized response ---
    return res.json(formatSuccess(response));

  } catch (err) {
    // If the httpClient threw a structured error (timeout, DNS, etc.),
    // return it as a response (not a 500) so the frontend can display it nicely
    if (err.code && err.status) {
      return res.status(err.status).json(formatError(err));
    }
    // Unknown error — pass to centralized error handler
    next(err);
  }
}

/**
 * Replaces {{VARIABLE}} placeholders in a string with values from the environment map.
 * Unresolved variables are left as-is (the user might want to see what's missing).
 * 
 * @param {string} str - The string with potential {{VARIABLE}} placeholders
 * @param {Object} env - Key-value map of variable names to values
 * @returns {string} The interpolated string
 */
function interpolateVariables(str, env) {
  return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return env.hasOwnProperty(varName) ? env[varName] : match;
  });
}

module.exports = { proxyRequest };
