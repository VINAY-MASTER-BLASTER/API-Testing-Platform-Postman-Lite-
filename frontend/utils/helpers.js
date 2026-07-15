/**
 * Utility helpers for the Postman Lite frontend.
 * 
 * Contains: variable interpolation, JSON validation, cURL generator,
 * debounce, formatting utilities, and more.
 */

/**
 * Replaces {{VARIABLE}} placeholders with values from the environment.
 * @param {string} str - String with {{VAR}} placeholders
 * @param {Object} env - Key-value map of variable values
 * @returns {string} Interpolated string
 */
export function interpolateVariables(str, env) {
  if (!str || !env) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return env.hasOwnProperty(varName) ? env[varName] : match;
  });
}

/**
 * Validates a JSON string and returns { valid, error }.
 * @param {string} str - JSON string to validate
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateJSON(str) {
  if (!str || !str.trim()) return { valid: true, error: null };
  try {
    JSON.parse(str);
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Pretty-prints a JSON string with 2-space indentation.
 * Returns the original string if it's not valid JSON.
 * @param {string} str - JSON string
 * @returns {string} Formatted JSON or original string
 */
export function formatJSON(str) {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

/**
 * Formats bytes into a human-readable string (B, KB, MB).
 * @param {number} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Formats milliseconds into a human-readable duration string.
 * @param {number} ms - Milliseconds
 * @returns {string}
 */
export function formatTime(ms) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Generates a cURL command for the given request configuration.
 * This is a bonus feature that helps developers copy/paste for debugging.
 * 
 * @param {Object} config - Request configuration
 * @returns {string} cURL command string
 */
export function generateCurl(config) {
  const parts = ['curl'];

  // Method (curl uses -X for non-GET methods)
  if (config.method && config.method !== 'GET') {
    parts.push(`-X ${config.method}`);
  }

  // URL (with query params)
  let url = config.url || '';
  if (config.params && config.params.length > 0) {
    const enabledParams = config.params.filter(p => p.enabled !== false && p.key);
    if (enabledParams.length > 0) {
      const qs = enabledParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value || '')}`).join('&');
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }
  parts.push(`'${url}'`);

  // Headers
  if (config.headers && config.headers.length > 0) {
    for (const h of config.headers) {
      if (h.enabled !== false && h.key) {
        parts.push(`-H '${h.key}: ${h.value || ''}'`);
      }
    }
  }

  // Body
  if (config.body && config.body.content && config.body.type !== 'none') {
    if (config.body.type === 'json' || config.body.type === 'raw') {
      parts.push(`-d '${config.body.content.replace(/'/g, "'\\''")}'`);
    } else if (config.body.type === 'urlencoded' && Array.isArray(config.body.content)) {
      const data = config.body.content
        .filter(p => p.enabled !== false && p.key)
        .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value || '')}`)
        .join('&');
      parts.push(`--data-urlencode '${data}'`);
    }
  }

  return parts.join(' \\\n  ');
}

/**
 * Generates a JavaScript fetch() snippet for the given request.
 * @param {Object} config - Request configuration
 * @returns {string} JavaScript code string
 */
export function generateFetchSnippet(config) {
  const options = { method: config.method || 'GET' };

  // Build headers object
  const headers = {};
  if (config.headers) {
    for (const h of config.headers) {
      if (h.enabled !== false && h.key) {
        headers[h.key] = h.value || '';
      }
    }
  }
  if (Object.keys(headers).length > 0) {
    options.headers = headers;
  }

  // Body
  if (config.body && config.body.content && config.body.type !== 'none') {
    options.body = config.body.content;
  }

  let code = `fetch('${config.url || ''}', ${JSON.stringify(options, null, 2)})\n`;
  code += `  .then(response => response.json())\n`;
  code += `  .then(data => console.log(data))\n`;
  code += `  .catch(error => console.error('Error:', error));`;

  return code;
}

/**
 * Debounce — delays invoking a function until after `wait` ms of inactivity.
 * Used to prevent excessive re-renders on rapid user input (e.g., URL typing).
 * 
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(fn, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Creates syntax-highlighted HTML for a JSON string.
 * Supports collapsible objects/arrays.
 * 
 * @param {*} data - Parsed JSON data (or a raw string to try parsing)
 * @param {number} indentLevel - Current indentation level (for recursion)
 * @returns {string} HTML string with syntax highlighting classes
 */
export function syntaxHighlightJSON(data, indentLevel = 0) {
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return escapeHtml(data);
    }
  }

  return renderJSONValue(data, indentLevel);
}

function renderJSONValue(value, indent) {
  const pad = '  '.repeat(indent);
  const padInner = '  '.repeat(indent + 1);

  if (value === null) {
    return `<span class="json-null">null</span>`;
  }

  if (typeof value === 'boolean') {
    return `<span class="json-boolean">${value}</span>`;
  }

  if (typeof value === 'number') {
    return `<span class="json-number">${value}</span>`;
  }

  if (typeof value === 'string') {
    return `<span class="json-string">"${escapeHtml(value)}"</span>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return `<span class="json-bracket">[]</span>`;

    let html = `<span class="json-collapsible"><span class="json-bracket">[</span>\n`;
    const items = value.map((item, i) => {
      const comma = i < value.length - 1 ? `<span class="json-comma">,</span>` : '';
      return `${padInner}${renderJSONValue(item, indent + 1)}${comma}`;
    });
    html += `<span class="json-children">${items.join('\n')}\n${pad}</span><span class="json-bracket">]</span></span>`;
    return html;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return `<span class="json-bracket">{}</span>`;

    let html = `<span class="json-collapsible"><span class="json-bracket">{</span>\n`;
    const items = keys.map((key, i) => {
      const comma = i < keys.length - 1 ? `<span class="json-comma">,</span>` : '';
      return `${padInner}<span class="json-key">"${escapeHtml(key)}"</span>: ${renderJSONValue(value[key], indent + 1)}${comma}`;
    });
    html += `<span class="json-children">${items.join('\n')}\n${pad}</span><span class="json-bracket">}</span></span>`;
    return html;
  }

  return escapeHtml(String(value));
}

/**
 * Escapes HTML special characters to prevent XSS.
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Returns the CSS class for an HTTP method (for color coding).
 */
export function getMethodClass(method) {
  return `method-${(method || 'get').toLowerCase()}`;
}

/**
 * Returns the status code CSS class for color coding.
 */
export function getStatusClass(status) {
  if (status >= 500) return 'status-5xx';
  if (status >= 400) return 'status-4xx';
  if (status >= 300) return 'status-3xx';
  if (status >= 200) return 'status-2xx';
  return '';
}

/**
 * Generates a short unique ID (for tabs, etc.)
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Deep clones an object (simple JSON-based clone).
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Common HTTP header names for autocomplete.
 */
export const COMMON_HEADERS = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'Cookie',
  'Host',
  'If-Modified-Since',
  'If-None-Match',
  'Origin',
  'Referer',
  'User-Agent',
  'X-Requested-With',
  'X-API-Key',
];

/**
 * Common Content-Type values for autocomplete.
 */
export const COMMON_CONTENT_TYPES = [
  'application/json',
  'application/xml',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'text/html',
  'text/xml',
];
