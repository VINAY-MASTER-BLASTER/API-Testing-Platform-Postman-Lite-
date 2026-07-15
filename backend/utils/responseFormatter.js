/**
 * Response formatter utility.
 * 
 * Normalizes raw HTTP response data into a consistent shape for the frontend.
 * This ensures the frontend always receives the same structure regardless of
 * whether the request succeeded, failed, or timed out.
 */

/**
 * Formats a successful response from the httpClient into the API contract shape.
 * 
 * @param {Object} rawResponse - The raw response from httpClient.executeRequest()
 * @returns {Object} Normalized response matching the API contract
 */
function formatSuccess(rawResponse) {
  return {
    status: rawResponse.status,
    statusText: rawResponse.statusText,
    headers: rawResponse.headers,
    body: rawResponse.body,
    timeMs: rawResponse.timeMs,
    sizeBytes: rawResponse.sizeBytes,
  };
}

/**
 * Formats an error into the standard error shape.
 * Used when the outbound request fails (timeout, DNS, connection refused, etc.)
 * 
 * @param {Error} error - The error thrown by httpClient
 * @returns {Object} Normalized error response
 */
function formatError(error) {
  return {
    error: {
      message: error.message || 'An unknown error occurred',
      code: error.code || 'UNKNOWN_ERROR',
    },
  };
}

/**
 * Formats the size in bytes to a human-readable string.
 * Used by the frontend to display response size.
 * 
 * @param {number} bytes - Size in bytes
 * @returns {string} Human-readable size string (e.g., "1.23 KB")
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

module.exports = { formatSuccess, formatError, formatSize };
