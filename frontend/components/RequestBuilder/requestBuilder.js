/**
 * Request Builder Component — The main workspace for constructing HTTP requests.
 * 
 * Layout:
 *   Row 1: Method dropdown + URL input + Send button
 *   Row 2: Sub-tabs for Params | Headers | Auth | Body
 *   Content: Dynamic content area based on active sub-tab
 * 
 * Features:
 * - Method selector with color coding
 * - URL input with {{VARIABLE}} support
 * - Query parameter builder (key/value rows with enable/disable)
 * - Headers builder with autocomplete
 * - Auth helpers (None, Bearer, Basic, API Key)
 * - Body editor (JSON with validation, Raw, Form Data, URL-encoded)
 * - Keyboard shortcuts (Ctrl+Enter to send)
 */

import { getState, setState, subscribe, addToHistory } from '../../services/stateManager.js';
import { sendProxyRequest } from '../../services/apiClient.js';
import { showToast } from '../Toast/toast.js';
import { updateCurrentTab } from '../TabsBar/tabsBar.js';
import {
  validateJSON, formatJSON, debounce, interpolateVariables,
  COMMON_HEADERS, COMMON_CONTENT_TYPES, generateCurl, generateFetchSnippet, getMethodClass,
} from '../../utils/helpers.js';

let builderEl = null;
let activeSubTab = 'params';

/**
 * Initializes the request builder component.
 * @param {HTMLElement} container - The request-panel DOM element
 */
export function initRequestBuilder(container) {
  builderEl = container;
  renderBuilder();

  // Re-render when active request changes (e.g., loading a saved request)
  subscribe('activeRequest', () => {
    renderBuilder();
  });
}

function renderBuilder() {
  const req = getState('activeRequest');

  builderEl.innerHTML = `
    <!-- URL Bar -->
    <div class="url-bar">
      <select class="method-select ${getMethodClass(req.method)}" id="method-select" aria-label="HTTP method">
        <option value="GET" ${req.method === 'GET' ? 'selected' : ''}>GET</option>
        <option value="POST" ${req.method === 'POST' ? 'selected' : ''}>POST</option>
        <option value="PUT" ${req.method === 'PUT' ? 'selected' : ''}>PUT</option>
        <option value="PATCH" ${req.method === 'PATCH' ? 'selected' : ''}>PATCH</option>
        <option value="DELETE" ${req.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
        <option value="QUERY" ${req.method === 'QUERY' ? 'selected' : ''}>QUERY</option>
      </select>
      <div class="url-input-wrapper">
        <input
          type="text"
          class="url-input"
          id="url-input"
          value="${escapeAttr(req.url)}"
          placeholder="Enter request URL (e.g., https://api.example.com/data or {{BASE_URL}}/users)"
          aria-label="Request URL"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <button class="btn btn-send" id="send-btn" title="Send request (Ctrl+Enter)">
        Send
      </button>
    </div>

    <!-- Sub-tabs -->
    <div class="request-tabs" role="tablist">
      <button class="request-tab ${activeSubTab === 'params' ? 'active' : ''}" data-subtab="params" role="tab">
        Params <span class="badge" id="params-count">${countEnabled(req.params)}</span>
      </button>
      <button class="request-tab ${activeSubTab === 'headers' ? 'active' : ''}" data-subtab="headers" role="tab">
        Headers <span class="badge" id="headers-count">${countEnabled(req.headers)}</span>
      </button>
      <button class="request-tab ${activeSubTab === 'auth' ? 'active' : ''}" data-subtab="auth" role="tab">
        Auth
      </button>
      <button class="request-tab ${activeSubTab === 'body' ? 'active' : ''}" data-subtab="body" role="tab">
        Body
      </button>
      <button class="request-tab" data-subtab="code" role="tab">
        Code ✨
      </button>
    </div>

    <!-- Sub-tab content -->
    <div class="request-tab-content" id="subtab-content">
    </div>
  `;

  // --- Event listeners ---

  // Method selector
  const methodSelect = builderEl.querySelector('#method-select');
  methodSelect.addEventListener('change', (e) => {
    updateActiveRequest({ method: e.target.value });
    methodSelect.className = `method-select ${getMethodClass(e.target.value)}`;
  });

  // URL input (debounced to avoid excessive state updates)
  const urlInput = builderEl.querySelector('#url-input');
  urlInput.addEventListener('input', debounce((e) => {
    updateActiveRequest({ url: e.target.value });
    syncParamsFromUrl(e.target.value);
  }, 300));

  // Send button
  builderEl.querySelector('#send-btn').addEventListener('click', sendRequest);

  // Sub-tab switching
  builderEl.querySelectorAll('.request-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeSubTab = tab.dataset.subtab;
      builderEl.querySelectorAll('.request-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderSubTabContent();
    });
  });

  // Render the initial sub-tab content
  renderSubTabContent();
}

/**
 * Renders the content area for the active sub-tab.
 */
function renderSubTabContent() {
  const content = builderEl.querySelector('#subtab-content');
  switch (activeSubTab) {
    case 'params': renderParamsTab(content); break;
    case 'headers': renderHeadersTab(content); break;
    case 'auth': renderAuthTab(content); break;
    case 'body': renderBodyTab(content); break;
    case 'code': renderCodeTab(content); break;
  }
}

// ============================================================================
// Params Tab
// ============================================================================

function renderParamsTab(container) {
  const req = getState('activeRequest');
  const params = req.params || [];

  container.innerHTML = `
    <div class="kv-editor" id="params-editor">
      ${params.map((p, i) => kvRow('param', i, p)).join('')}
      <button class="kv-add-btn" id="add-param-btn">+ Add Parameter</button>
    </div>
  `;

  bindKvEvents(container, 'param', params, (updated) => {
    updateActiveRequest({ params: updated });
    syncUrlFromParams(updated);
    updateBadge('params-count', countEnabled(updated));
  });
}

// ============================================================================
// Headers Tab
// ============================================================================

function renderHeadersTab(container) {
  const req = getState('activeRequest');
  const headers = req.headers || [];

  container.innerHTML = `
    <div class="kv-editor" id="headers-editor">
      ${headers.map((h, i) => kvRow('header', i, h, true)).join('')}
      <button class="kv-add-btn" id="add-header-btn">+ Add Header</button>
    </div>
  `;

  bindKvEvents(container, 'header', headers, (updated) => {
    updateActiveRequest({ headers: updated });
    updateBadge('headers-count', countEnabled(updated));
  });

  // Header name autocomplete
  container.querySelectorAll('.kv-key').forEach(input => {
    setupAutocomplete(input, COMMON_HEADERS);
  });
}

// ============================================================================
// Auth Tab
// ============================================================================

function renderAuthTab(container) {
  const req = getState('activeRequest');
  const auth = req.auth || { type: 'none' };

  container.innerHTML = `
    <div class="auth-section">
      <div class="auth-type-selector">
        <button class="auth-type-btn ${auth.type === 'none' ? 'active' : ''}" data-auth="none">No Auth</button>
        <button class="auth-type-btn ${auth.type === 'bearer' ? 'active' : ''}" data-auth="bearer">Bearer Token</button>
        <button class="auth-type-btn ${auth.type === 'basic' ? 'active' : ''}" data-auth="basic">Basic Auth</button>
        <button class="auth-type-btn ${auth.type === 'apikey' ? 'active' : ''}" data-auth="apikey">API Key</button>
      </div>
      <div class="auth-fields" id="auth-fields">
        ${renderAuthFields(auth)}
      </div>
    </div>
  `;

  // Auth type switching
  container.querySelectorAll('.auth-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.auth-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const newAuth = { type: btn.dataset.auth };
      updateActiveRequest({ auth: newAuth });
      container.querySelector('#auth-fields').innerHTML = renderAuthFields(newAuth);
      bindAuthFieldEvents(container);
    });
  });

  bindAuthFieldEvents(container);
}

function renderAuthFields(auth) {
  switch (auth.type) {
    case 'bearer':
      return `
        <div class="auth-field-group">
          <label for="auth-token">Token</label>
          <input type="text" class="input input-mono" id="auth-token" 
            value="${escapeAttr(auth.token || '')}" 
            placeholder="Enter bearer token or {{TOKEN}}" />
        </div>
        <div class="text-xs text-secondary mt-2">
          ℹ️ Will add header: <code>Authorization: Bearer &lt;token&gt;</code>
        </div>
      `;
    case 'basic':
      return `
        <div class="auth-field-group">
          <label for="auth-username">Username</label>
          <input type="text" class="input" id="auth-username" 
            value="${escapeAttr(auth.username || '')}" 
            placeholder="Username" />
        </div>
        <div class="auth-field-group">
          <label for="auth-password">Password</label>
          <input type="password" class="input" id="auth-password" 
            value="${escapeAttr(auth.password || '')}" 
            placeholder="Password" />
        </div>
        <div class="text-xs text-secondary mt-2">
          ℹ️ Will add header: <code>Authorization: Basic &lt;base64&gt;</code>
        </div>
      `;
    case 'apikey':
      return `
        <div class="auth-field-group">
          <label for="auth-key-name">Key</label>
          <input type="text" class="input" id="auth-key-name" 
            value="${escapeAttr(auth.key || '')}" 
            placeholder="e.g., X-API-Key" />
        </div>
        <div class="auth-field-group">
          <label for="auth-key-value">Value</label>
          <input type="text" class="input input-mono" id="auth-key-value" 
            value="${escapeAttr(auth.value || '')}" 
            placeholder="API key value" />
        </div>
        <div class="auth-field-group">
          <label>Add to</label>
          <div style="display:flex;gap:8px;">
            <button class="auth-type-btn btn-sm ${auth.addTo !== 'query' ? 'active' : ''}" data-add-to="header">Header</button>
            <button class="auth-type-btn btn-sm ${auth.addTo === 'query' ? 'active' : ''}" data-add-to="query">Query Param</button>
          </div>
        </div>
      `;
    default:
      return `
        <div class="empty-state" style="padding: 24px 0;">
          <div class="empty-state-icon">🔓</div>
          <div class="empty-state-text">No authentication configured for this request</div>
        </div>
      `;
  }
}

function bindAuthFieldEvents(container) {
  const auth = getState('activeRequest').auth || { type: 'none' };

  if (auth.type === 'bearer') {
    const tokenInput = container.querySelector('#auth-token');
    if (tokenInput) {
      tokenInput.addEventListener('input', (e) => {
        updateActiveRequest({ auth: { ...auth, token: e.target.value } });
      });
    }
  }

  if (auth.type === 'basic') {
    const usernameInput = container.querySelector('#auth-username');
    const passwordInput = container.querySelector('#auth-password');
    if (usernameInput) {
      usernameInput.addEventListener('input', (e) => {
        updateActiveRequest({ auth: { ...auth, username: e.target.value } });
      });
    }
    if (passwordInput) {
      passwordInput.addEventListener('input', (e) => {
        updateActiveRequest({ auth: { ...auth, password: e.target.value } });
      });
    }
  }

  if (auth.type === 'apikey') {
    const keyName = container.querySelector('#auth-key-name');
    const keyValue = container.querySelector('#auth-key-value');
    if (keyName) {
      keyName.addEventListener('input', (e) => {
        updateActiveRequest({ auth: { ...auth, key: e.target.value } });
      });
    }
    if (keyValue) {
      keyValue.addEventListener('input', (e) => {
        updateActiveRequest({ auth: { ...auth, value: e.target.value } });
      });
    }
    container.querySelectorAll('[data-add-to]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('[data-add-to]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateActiveRequest({ auth: { ...auth, addTo: btn.dataset.addTo } });
      });
    });
  }
}

// ============================================================================
// Body Tab
// ============================================================================

function renderBodyTab(container) {
  const req = getState('activeRequest');
  const body = req.body || { type: 'none', content: '' };

  container.innerHTML = `
    <div class="body-type-selector">
      <button class="body-type-btn ${body.type === 'none' ? 'active' : ''}" data-body-type="none">None</button>
      <button class="body-type-btn ${body.type === 'json' ? 'active' : ''}" data-body-type="json">JSON</button>
      <button class="body-type-btn ${body.type === 'raw' ? 'active' : ''}" data-body-type="raw">Raw</button>
      <button class="body-type-btn ${body.type === 'urlencoded' ? 'active' : ''}" data-body-type="urlencoded">x-www-form-urlencoded</button>
      <button class="body-type-btn ${body.type === 'formdata' ? 'active' : ''}" data-body-type="formdata">Form Data</button>
    </div>
    <div id="body-content">
      ${renderBodyContent(body)}
    </div>
  `;

  // Body type switching
  container.querySelectorAll('.body-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.body-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const newBody = { type: btn.dataset.bodyType, content: '' };
      if (btn.dataset.bodyType === 'urlencoded' || btn.dataset.bodyType === 'formdata') {
        newBody.content = [];
      }
      updateActiveRequest({ body: newBody });
      container.querySelector('#body-content').innerHTML = renderBodyContent(newBody);
      bindBodyContentEvents(container);
    });
  });

  bindBodyContentEvents(container);
}

function renderBodyContent(body) {
  switch (body.type) {
    case 'json':
      const validation = validateJSON(body.content || '');
      return `
        <div class="json-validation ${validation.valid ? 'valid' : 'invalid'}">
          ${validation.valid ? '✓ Valid JSON' : `✕ ${validation.error || 'Invalid JSON'}`}
          <button class="btn btn-ghost btn-sm" id="format-json-btn" style="margin-left:auto;">Format</button>
        </div>
        <textarea class="textarea" id="body-json" 
          placeholder='{\n  "key": "value"\n}'
          spellcheck="false">${escapeHtml(body.content || '')}</textarea>
      `;

    case 'raw':
      return `
        <textarea class="textarea" id="body-raw" 
          placeholder="Enter raw request body"
          spellcheck="false">${escapeHtml(body.content || '')}</textarea>
      `;

    case 'urlencoded':
      const urlParams = Array.isArray(body.content) ? body.content : [];
      return `
        <div class="kv-editor" id="urlencoded-editor">
          ${urlParams.map((p, i) => kvRow('urlenc', i, p)).join('')}
          <button class="kv-add-btn" id="add-urlenc-btn">+ Add Field</button>
        </div>
      `;

    case 'formdata':
      const formFields = Array.isArray(body.content) ? body.content : [];
      return `
        <div class="kv-editor" id="formdata-editor">
          ${formFields.map((p, i) => kvRow('formdata', i, p)).join('')}
          <button class="kv-add-btn" id="add-formdata-btn">+ Add Field</button>
        </div>
      `;

    default:
      return `
        <div class="empty-state" style="padding: 24px 0;">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-text">This request does not have a body</div>
        </div>
      `;
  }
}

function bindBodyContentEvents(container) {
  const body = getState('activeRequest').body || { type: 'none' };

  if (body.type === 'json') {
    const textarea = container.querySelector('#body-json');
    const formatBtn = container.querySelector('#format-json-btn');

    if (textarea) {
      textarea.addEventListener('input', debounce((e) => {
        updateActiveRequest({ body: { ...body, content: e.target.value } });
        // Update validation indicator
        const validation = validateJSON(e.target.value);
        const indicator = container.querySelector('.json-validation');
        if (indicator) {
          indicator.className = `json-validation ${validation.valid ? 'valid' : 'invalid'}`;
          indicator.firstElementChild && (indicator.innerHTML = `
            ${validation.valid ? '✓ Valid JSON' : `✕ ${validation.error || 'Invalid JSON'}`}
            <button class="btn btn-ghost btn-sm" id="format-json-btn" style="margin-left:auto;">Format</button>
          `);
          // Re-bind format button
          const newFormatBtn = container.querySelector('#format-json-btn');
          if (newFormatBtn) {
            newFormatBtn.addEventListener('click', () => {
              textarea.value = formatJSON(textarea.value);
              updateActiveRequest({ body: { ...body, content: textarea.value } });
            });
          }
        }
      }, 300));
    }

    if (formatBtn) {
      formatBtn.addEventListener('click', () => {
        textarea.value = formatJSON(textarea.value);
        updateActiveRequest({ body: { ...body, content: textarea.value } });
      });
    }
  }

  if (body.type === 'raw') {
    const textarea = container.querySelector('#body-raw');
    if (textarea) {
      textarea.addEventListener('input', debounce((e) => {
        updateActiveRequest({ body: { ...body, content: e.target.value } });
      }, 300));
    }
  }

  if (body.type === 'urlencoded') {
    const params = Array.isArray(body.content) ? body.content : [];
    bindKvEvents(container, 'urlenc', params, (updated) => {
      updateActiveRequest({ body: { ...body, content: updated } });
    });
  }

  if (body.type === 'formdata') {
    const fields = Array.isArray(body.content) ? body.content : [];
    bindKvEvents(container, 'formdata', fields, (updated) => {
      updateActiveRequest({ body: { ...body, content: updated } });
    });
  }
}

// ============================================================================
// Code Snippet Tab (Bonus)
// ============================================================================

function renderCodeTab(container) {
  const req = getState('activeRequest');

  const curlCmd = generateCurl(req);
  const fetchCode = generateFetchSnippet(req);

  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span class="text-sm" style="font-weight:600;">cURL</span>
        <button class="btn btn-ghost btn-sm" id="copy-curl-btn">📋 Copy</button>
      </div>
      <pre class="textarea" style="min-height:auto;resize:none;cursor:text;">${escapeHtml(curlCmd)}</pre>
    </div>
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span class="text-sm" style="font-weight:600;">JavaScript (fetch)</span>
        <button class="btn btn-ghost btn-sm" id="copy-fetch-btn">📋 Copy</button>
      </div>
      <pre class="textarea" style="min-height:auto;resize:none;cursor:text;">${escapeHtml(fetchCode)}</pre>
    </div>
  `;

  container.querySelector('#copy-curl-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(curlCmd);
    showToast('cURL command copied!', 'success');
  });

  container.querySelector('#copy-fetch-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(fetchCode);
    showToast('Fetch snippet copied!', 'success');
  });
}

// ============================================================================
// Send Request
// ============================================================================

async function sendRequest() {
  const req = getState('activeRequest');

  if (!req.url) {
    showToast('Please enter a URL', 'warning');
    return;
  }

  // Show loading state
  setState('isLoading', true);
  const sendBtn = builderEl.querySelector('#send-btn');
  sendBtn.innerHTML = '<span class="spinner"></span> Sending...';
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

  try {
    // Resolve environment variables
    const activeEnvId = getState('activeEnvironmentId');
    const environments = getState('environments') || [];
    const activeEnv = environments.find(e => e.id === activeEnvId);

    let environment = {};
    if (activeEnv) {
      for (const v of activeEnv.variables || []) {
        if (v.enabled !== false && v.key) {
          environment[v.key] = v.value;
        }
      }
    }

    // Build the request config for the proxy
    const proxyConfig = {
      method: req.method || 'GET',
      url: req.url,
      headers: {},
      params: req.params || [],
      auth: req.auth || { type: 'none' },
      environment,
    };

    // Convert headers array to object
    for (const h of (req.headers || [])) {
      if (h.enabled !== false && h.key) {
        proxyConfig.headers[h.key] = h.value || '';
      }
    }

    // Add body based on type
    const body = req.body || { type: 'none' };
    if (body.type === 'json' && body.content) {
      proxyConfig.body = body.content;
      if (!proxyConfig.headers['Content-Type']) {
        proxyConfig.headers['Content-Type'] = 'application/json';
      }
    } else if (body.type === 'raw' && body.content) {
      proxyConfig.body = body.content;
    } else if (body.type === 'urlencoded' && Array.isArray(body.content)) {
      const data = body.content
        .filter(p => p.enabled !== false && p.key)
        .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value || '')}`)
        .join('&');
      proxyConfig.body = data;
      if (!proxyConfig.headers['Content-Type']) {
        proxyConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    } else if (body.type === 'formdata' && Array.isArray(body.content)) {
      // For form data, send as JSON (the backend will handle it)
      const formObj = {};
      body.content.filter(p => p.enabled !== false && p.key).forEach(p => {
        formObj[p.key] = p.value || '';
      });
      proxyConfig.body = formObj;
    }

    // Send through proxy
    const response = await sendProxyRequest(proxyConfig);

    // Update state with response
    setState('response', response);

    // Add to history
    addToHistory({
      method: req.method,
      url: req.url,
      status: response.status || (response.error ? 0 : null),
      timeMs: response.timeMs,
      headers: req.headers,
      params: req.params,
      body: req.body,
      auth: req.auth,
    });

    // Update current tab
    updateCurrentTab();

  } catch (err) {
    setState('response', {
      error: {
        message: err.message || 'Failed to send request',
        code: 'CLIENT_ERROR',
      },
    });
    showToast(err.message || 'Failed to send request', 'error');
  } finally {
    // Reset loading state
    setState('isLoading', false);
    sendBtn.innerHTML = 'Send';
    sendBtn.disabled = false;
    sendBtn.classList.remove('loading');
  }
}

// ============================================================================
// Key-Value Row Helpers (shared by Params, Headers, Form Data, URL-encoded)
// ============================================================================

function kvRow(prefix, index, data = {}, showAutocomplete = false) {
  return `
    <div class="kv-row" data-index="${index}">
      <input type="checkbox" class="checkbox kv-checkbox" 
        ${data.enabled !== false ? 'checked' : ''} 
        aria-label="Enable/disable"
        data-prefix="${prefix}" data-field="enabled" data-index="${index}" />
      <input type="text" class="input input-mono kv-key" 
        value="${escapeAttr(data.key || '')}" 
        placeholder="Key"
        data-prefix="${prefix}" data-field="key" data-index="${index}"
        aria-label="Key"
        ${showAutocomplete ? 'list="header-suggestions"' : ''} />
      <input type="text" class="input input-mono kv-value" 
        value="${escapeAttr(data.value || '')}" 
        placeholder="Value"
        data-prefix="${prefix}" data-field="value" data-index="${index}"
        aria-label="Value" />
      <div class="kv-actions">
        <button class="btn-icon btn-sm" data-action="remove" data-prefix="${prefix}" data-index="${index}" 
          aria-label="Remove row" title="Remove">✕</button>
      </div>
    </div>
  `;
}

function bindKvEvents(container, prefix, items, onChange) {
  // Input changes (debounced)
  container.querySelectorAll(`[data-prefix="${prefix}"][data-field="key"], [data-prefix="${prefix}"][data-field="value"]`)
    .forEach(input => {
      input.addEventListener('input', debounce(() => {
        const idx = parseInt(input.dataset.index);
        if (!items[idx]) items[idx] = { key: '', value: '', enabled: true };
        items[idx][input.dataset.field] = input.value;
        onChange([...items]);
      }, 200));
    });

  // Checkbox changes
  container.querySelectorAll(`[data-prefix="${prefix}"][data-field="enabled"]`)
    .forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const idx = parseInt(checkbox.dataset.index);
        if (!items[idx]) items[idx] = { key: '', value: '', enabled: true };
        items[idx].enabled = checkbox.checked;
        onChange([...items]);
      });
    });

  // Remove row
  container.querySelectorAll(`[data-action="remove"][data-prefix="${prefix}"]`)
    .forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        items.splice(idx, 1);
        onChange([...items]);
        // Re-render the sub-tab
        renderSubTabContent();
      });
    });

  // Add row
  const addBtn = container.querySelector(`#add-${prefix}-btn`);
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      items.push({ key: '', value: '', enabled: true });
      onChange([...items]);
      renderSubTabContent();
    });
  }
}

// ============================================================================
// URL ↔ Params Sync
// ============================================================================

function syncParamsFromUrl(url) {
  try {
    const urlObj = new URL(url.includes('://') ? url : 'http://placeholder' + url);
    const params = [];
    urlObj.searchParams.forEach((value, key) => {
      params.push({ key, value, enabled: true });
    });
    if (params.length > 0) {
      updateActiveRequest({ params }, true);
    }
  } catch {
    // Invalid URL — don't sync
  }
}

function syncUrlFromParams(params) {
  const req = getState('activeRequest');
  try {
    const url = req.url || '';
    if (!url) return;
    const urlObj = new URL(url.includes('://') ? url : 'http://placeholder' + url);
    // Clear existing params
    const keys = [...urlObj.searchParams.keys()];
    keys.forEach(k => urlObj.searchParams.delete(k));
    // Add enabled params
    for (const p of params) {
      if (p.enabled !== false && p.key) {
        urlObj.searchParams.set(p.key, p.value || '');
      }
    }
    const newUrl = url.includes('://') ? urlObj.toString() : urlObj.pathname + urlObj.search;
    const urlInput = builderEl.querySelector('#url-input');
    if (urlInput && urlInput.value !== newUrl) {
      urlInput.value = newUrl;
      updateActiveRequest({ url: newUrl }, true);
    }
  } catch {
    // Invalid URL — don't sync
  }
}

// ============================================================================
// Autocomplete Helper
// ============================================================================

function setupAutocomplete(input, suggestions) {
  // Use a simple datalist for autocomplete
  let datalist = document.getElementById('header-suggestions');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'header-suggestions';
    datalist.innerHTML = suggestions.map(s => `<option value="${s}">`).join('');
    document.body.appendChild(datalist);
  }
  input.setAttribute('list', 'header-suggestions');
}

// ============================================================================
// Helpers
// ============================================================================

function updateActiveRequest(updates, skipRender = false) {
  const current = getState('activeRequest');
  const updated = { ...current, ...updates };
  if (skipRender) {
    // Directly update state without triggering re-render
    // (used for URL↔params sync to avoid infinite loops)
    const stateObj = { ...updated };
    setState('activeRequest', stateObj);
  } else {
    setState('activeRequest', updated);
  }
}

function countEnabled(items) {
  if (!items || !Array.isArray(items)) return 0;
  return items.filter(i => i.enabled !== false && i.key).length;
}

function updateBadge(id, count) {
  const badge = builderEl.querySelector(`#${id}`);
  if (badge) badge.textContent = count;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
