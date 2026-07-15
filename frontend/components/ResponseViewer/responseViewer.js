/**
 * Response Viewer Component — Displays the result of a proxy request.
 * 
 * Layout:
 *   Status bar: status badge + response time + response size + action buttons
 *   Tabs: Pretty | Raw | Headers | Preview
 *   Content: Tab-specific content area
 * 
 * Features:
 * - Color-coded status badge (2xx green, 3xx blue, 4xx orange, 5xx red)
 * - Pretty-printed JSON with collapsible tree view
 * - Raw text view
 * - Response headers table
 * - HTML/image preview
 * - Copy and Download buttons
 */

import { getState, subscribe } from '../../services/stateManager.js';
import { showToast } from '../Toast/toast.js';
import { syntaxHighlightJSON, formatSize, formatTime, getStatusClass, escapeHtml } from '../../utils/helpers.js';

let viewerEl = null;
let activeResponseTab = 'pretty';

/**
 * Initializes the response viewer component.
 * @param {HTMLElement} container - The response-panel DOM element
 */
export function initResponseViewer(container) {
  viewerEl = container;
  renderEmptyState();

  // Re-render when response changes
  subscribe('response', renderResponse);
  subscribe('isLoading', (loading) => {
    if (loading) renderLoadingState();
  });
}

/**
 * Renders the empty state (no response yet).
 */
function renderEmptyState() {
  viewerEl.innerHTML = `
    <div class="empty-state" style="flex:1;">
      <div class="empty-state-icon">📡</div>
      <div class="empty-state-title">No response yet</div>
      <div class="empty-state-text">Send a request to see the response here</div>
      <div class="text-xs text-tertiary mt-4">Tip: Use Ctrl+Enter to quickly send a request</div>
    </div>
  `;
}

/**
 * Renders the loading state while a request is in flight.
 */
function renderLoadingState() {
  viewerEl.innerHTML = `
    <div class="empty-state" style="flex:1;">
      <div class="spinner spinner-lg"></div>
      <div class="empty-state-title" style="margin-top:16px;">Sending request...</div>
      <div class="empty-state-text">Waiting for response from the server</div>
    </div>
  `;
}

/**
 * Renders the response (success or error).
 */
function renderResponse(response) {
  if (!response) {
    renderEmptyState();
    return;
  }

  // Check if it's an error response
  if (response.error) {
    renderErrorResponse(response.error);
    return;
  }

  renderSuccessResponse(response);
}

/**
 * Renders a successful response with status, headers, body.
 */
function renderSuccessResponse(response) {
  const statusClass = getStatusClass(response.status);
  const statusText = response.statusText || getStatusText(response.status);

  viewerEl.innerHTML = `
    <!-- Status Bar -->
    <div class="response-status-bar">
      <div class="response-status-bar-left">
        <span class="status-badge ${statusClass}">
          ${response.status} ${safeHtml(statusText)}
        </span>
        <span class="info-badge" title="Response time">
          ⏱ ${formatTime(response.timeMs)}
        </span>
        <span class="info-badge" title="Response size">
          📦 ${formatSize(response.sizeBytes)}
        </span>
      </div>
      <div class="response-status-bar-right">
        <button class="btn btn-ghost btn-sm" id="copy-response-btn" title="Copy response body">
          📋 Copy
        </button>
        <button class="btn btn-ghost btn-sm" id="download-response-btn" title="Download response">
          ⬇ Download
        </button>
      </div>
    </div>

    <!-- Response Tabs -->
    <div class="response-tabs" role="tablist">
      <button class="response-tab ${activeResponseTab === 'pretty' ? 'active' : ''}" data-rtab="pretty" role="tab">Pretty</button>
      <button class="response-tab ${activeResponseTab === 'raw' ? 'active' : ''}" data-rtab="raw" role="tab">Raw</button>
      <button class="response-tab ${activeResponseTab === 'headers' ? 'active' : ''}" data-rtab="headers" role="tab">
        Headers <span class="badge">${Object.keys(response.headers || {}).length}</span>
      </button>
      <button class="response-tab ${activeResponseTab === 'preview' ? 'active' : ''}" data-rtab="preview" role="tab">Preview</button>
    </div>

    <!-- Response Body -->
    <div class="response-body" id="response-body-content">
    </div>
  `;

  // Event listeners
  viewerEl.querySelector('#copy-response-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(response.body || '');
    showToast('Response copied to clipboard', 'success');
  });

  viewerEl.querySelector('#download-response-btn').addEventListener('click', () => {
    downloadResponse(response);
  });

  // Tab switching
  viewerEl.querySelectorAll('.response-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeResponseTab = tab.dataset.rtab;
      viewerEl.querySelectorAll('.response-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderResponseTabContent(response);
    });
  });

  // Render initial tab content
  renderResponseTabContent(response);
}

/**
 * Renders the content for the active response tab.
 */
function renderResponseTabContent(response) {
  const content = viewerEl.querySelector('#response-body-content');
  if (!content) return;

  switch (activeResponseTab) {
    case 'pretty':
      renderPrettyTab(content, response);
      break;
    case 'raw':
      renderRawTab(content, response);
      break;
    case 'headers':
      renderHeadersTab(content, response);
      break;
    case 'preview':
      renderPreviewTab(content, response);
      break;
  }
}

/**
 * Pretty tab — JSON with syntax highlighting and collapsible tree.
 */
function renderPrettyTab(container, response) {
  const body = response.body || '';
  const contentType = (response.headers && (response.headers['content-type'] || '')) || '';

  if (contentType.includes('json') || looksLikeJSON(body)) {
    try {
      const parsed = JSON.parse(body);
      const highlighted = syntaxHighlightJSON(parsed);
      container.innerHTML = `<div class="json-viewer" style="padding-left:20px;">${highlighted}</div>`;

      // Add click handlers for collapsible nodes
      container.querySelectorAll('.json-collapsible').forEach(node => {
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          node.classList.toggle('collapsed');
        });
      });
    } catch {
      container.innerHTML = `<pre class="json-viewer">${safeHtml(body)}</pre>`;
    }
  } else if (contentType.includes('xml') || contentType.includes('html')) {
    // Show as formatted text for XML/HTML
    container.innerHTML = `<pre class="json-viewer">${safeHtml(body)}</pre>`;
  } else {
    container.innerHTML = `<pre class="json-viewer">${safeHtml(body)}</pre>`;
  }
}

/**
 * Raw tab — plain text.
 */
function renderRawTab(container, response) {
  container.innerHTML = `
    <pre class="json-viewer" style="white-space: pre-wrap; word-break: break-all;">${safeHtml(response.body || '')}</pre>
  `;
}

/**
 * Headers tab — response headers table.
 */
function renderHeadersTab(container, response) {
  const headers = response.headers || {};
  const entries = Object.entries(headers);

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 24px 0;">
        <div class="empty-state-text">No response headers</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table class="headers-table">
      <thead>
        <tr>
          <th>Header</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(([key, value]) => `
          <tr>
            <td>${safeHtml(key)}</td>
            <td>${safeHtml(value)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Preview tab — renders HTML in a sandboxed iframe or shows images.
 */
function renderPreviewTab(container, response) {
  const contentType = (response.headers && (response.headers['content-type'] || '')) || '';
  const body = response.body || '';

  if (contentType.includes('html')) {
    container.innerHTML = `
      <iframe class="preview-frame" sandbox="allow-same-origin" style="min-height:400px;" title="Response preview"></iframe>
    `;
    const iframe = container.querySelector('iframe');
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(body);
    doc.close();
  } else if (contentType.includes('image')) {
    // Try to create a data URL from the response
    container.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <img class="preview-image" src="data:${contentType};base64,${btoa(body)}" alt="Response image" />
      </div>
    `;
  } else if (contentType.includes('json') || looksLikeJSON(body)) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 24px 0;">
        <div class="empty-state-icon">📄</div>
        <div class="empty-state-text">JSON responses are best viewed in the Pretty tab</div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="empty-state" style="padding: 24px 0;">
        <div class="empty-state-icon">🖼️</div>
        <div class="empty-state-text">Preview is available for HTML and image responses</div>
        <div class="text-xs text-tertiary">Content-Type: ${safeHtml(contentType || 'unknown')}</div>
      </div>
    `;
  }
}

/**
 * Renders an error response (network errors, timeouts, etc.).
 */
function renderErrorResponse(error) {
  viewerEl.innerHTML = `
    <div class="response-status-bar">
      <div class="response-status-bar-left">
        <span class="status-badge status-5xx">Error</span>
        <span class="info-badge">${safeHtml(error.code || 'UNKNOWN')}</span>
      </div>
    </div>
    <div class="response-body">
      <div class="empty-state" style="padding: 32px 0;">
        <div class="empty-state-icon" style="font-size:2.5rem;">❌</div>
        <div class="empty-state-title" style="color:var(--color-error);">Request Failed</div>
        <div class="empty-state-text" style="max-width:500px;">${safeHtml(error.message)}</div>
      </div>
    </div>
  `;
}

// ============================================================================
// Helpers
// ============================================================================

function downloadResponse(response) {
  const contentType = (response.headers && response.headers['content-type']) || 'text/plain';
  let extension = 'txt';
  if (contentType.includes('json')) extension = 'json';
  if (contentType.includes('html')) extension = 'html';
  if (contentType.includes('xml')) extension = 'xml';

  const blob = new Blob([response.body || ''], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `response.${extension}`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Response downloaded', 'success');
}

function looksLikeJSON(str) {
  if (!str) return false;
  const trimmed = str.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

function getStatusText(status) {
  const texts = {
    200: 'OK', 201: 'Created', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    405: 'Method Not Allowed', 408: 'Request Timeout', 409: 'Conflict',
    429: 'Too Many Requests',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return texts[status] || '';
}

function safeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
