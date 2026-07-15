/**
 * Sidebar Component — Collections tree, History list, and Environment manager.
 * 
 * The sidebar has three tabs:
 * 1. Collections — tree view of saved request groups
 * 2. History — chronological list of recently sent requests
 * 3. Environments — manage variable sets
 * 
 * The sidebar is collapsible (toggle button in top bar) and becomes
 * an overlay drawer on tablet/mobile viewports.
 */

import { getState, setState, subscribe, clearHistory } from '../../services/stateManager.js';
import * as api from '../../services/apiClient.js';
import { showToast } from '../Toast/toast.js';
import { getMethodClass, formatTime } from '../../utils/helpers.js';

let sidebarEl = null;
let overlayEl = null;

/**
 * Initializes the sidebar component.
 * @param {HTMLElement} container - The sidebar DOM element
 * @param {HTMLElement} overlay - The sidebar overlay DOM element
 */
export function initSidebar(container, overlay) {
  sidebarEl = container;
  overlayEl = overlay;

  renderSidebar();
  loadCollections();

  // Subscribe to state changes
  subscribe('collections', renderCollectionsTab);
  subscribe('history', renderHistoryTab);
  subscribe('environments', renderEnvironmentsTab);
  subscribe('sidebarCollapsed', updateCollapsedState);
  subscribe('sidebarActiveTab', renderActiveTab);

  // Overlay click closes sidebar on mobile
  overlayEl.addEventListener('click', () => toggleSidebar());
}

/**
 * Renders the sidebar structure.
 */
function renderSidebar() {
  sidebarEl.innerHTML = `
    <div class="sidebar-header">
      <span style="font-weight: 600; font-size: 0.9rem;">Explorer</span>
      <button class="btn-icon" id="sidebar-close-btn" aria-label="Close sidebar" title="Close sidebar">✕</button>
    </div>
    <div class="sidebar-tabs" role="tablist">
      <button class="sidebar-tab active" data-tab="collections" role="tab" aria-selected="true">Collections</button>
      <button class="sidebar-tab" data-tab="history" role="tab" aria-selected="false">History</button>
      <button class="sidebar-tab" data-tab="environments" role="tab" aria-selected="false">Envs</button>
    </div>
    <div class="sidebar-content" id="sidebar-panel">
    </div>
    <div class="sidebar-actions" id="sidebar-actions">
    </div>
  `;

  // Tab switching
  sidebarEl.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setState('sidebarActiveTab', tab.dataset.tab);
    });
  });

  // Close button
  sidebarEl.querySelector('#sidebar-close-btn').addEventListener('click', () => toggleSidebar());

  // Initial render
  renderActiveTab(getState('sidebarActiveTab') || 'collections');
}

/**
 * Renders the active sidebar tab content.
 */
function renderActiveTab(tabName) {
  // Update tab button styles
  sidebarEl.querySelectorAll('.sidebar-tab').forEach(tab => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  switch (tabName) {
    case 'collections':
      renderCollectionsTab();
      break;
    case 'history':
      renderHistoryTab();
      break;
    case 'environments':
      renderEnvironmentsTab();
      break;
  }
}

// ============================================================================
// Collections Tab
// ============================================================================

async function loadCollections() {
  try {
    const collections = await api.getCollections();
    setState('collections', collections);
  } catch (err) {
    showToast('Failed to load collections: ' + err.message, 'error');
  }
}

function renderCollectionsTab() {
  const panel = sidebarEl.querySelector('#sidebar-panel');
  const actions = sidebarEl.querySelector('#sidebar-actions');
  const collections = getState('collections') || [];

  if (collections.length === 0) {
    panel.innerHTML = `
      <div class="empty-state" style="padding: 24px 16px;">
        <div class="empty-state-icon">📁</div>
        <div class="empty-state-title">No collections yet</div>
        <div class="empty-state-text">Create your first collection to organize API requests</div>
      </div>
    `;
  } else {
    panel.innerHTML = `
      <input type="text" class="sidebar-search" placeholder="Search collections..." aria-label="Search collections" id="collection-search">
      <div id="collections-tree"></div>
    `;

    const tree = panel.querySelector('#collections-tree');
    renderCollectionTree(tree, collections);

    // Search filter
    const searchInput = panel.querySelector('#collection-search');
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      filterCollections(tree, query);
    });
  }

  actions.innerHTML = `
    <button class="btn btn-primary btn-sm" style="width:100%;" id="create-collection-btn">
      + New Collection
    </button>
  `;

  actions.querySelector('#create-collection-btn').addEventListener('click', promptCreateCollection);
}

function renderCollectionTree(container, collections) {
  container.innerHTML = '';

  for (const collection of collections) {
    const item = document.createElement('div');
    item.className = 'collection-item';
    item.dataset.id = collection.id;

    const requests = collection.requests || [];
    const isOpen = item.dataset.open !== 'false';

    item.innerHTML = `
      <div class="collection-header" tabindex="0" role="button" aria-expanded="${isOpen}">
        <span class="caret ${isOpen ? 'open' : ''}">▶</span>
        <span class="collection-name">${escapeHtml(collection.name)}</span>
        <span class="collection-count">${requests.length}</span>
        <button class="btn-icon btn-sm" data-action="collection-menu" data-id="${collection.id}" aria-label="Collection options" title="Options">⋮</button>
      </div>
      <div class="collection-requests" style="${isOpen ? '' : 'max-height:0;overflow:hidden;'}">
        ${requests.map(req => `
          <div class="request-item" data-request-id="${req.id}" data-collection-id="${collection.id}" tabindex="0">
            <span class="method-badge ${getMethodClass(req.method)}">${req.method}</span>
            <span class="request-name">${escapeHtml(req.name || req.url)}</span>
          </div>
        `).join('')}
        <button class="kv-add-btn btn-sm" data-action="add-request" data-collection-id="${collection.id}" style="margin-top: 4px;">
          + Add Request
        </button>
      </div>
    `;

    // Toggle expand/collapse
    const header = item.querySelector('.collection-header');
    header.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="collection-menu"]')) return;
      const caret = header.querySelector('.caret');
      const requestsDiv = item.querySelector('.collection-requests');
      const isExpanded = caret.classList.contains('open');
      caret.classList.toggle('open');
      requestsDiv.style.maxHeight = isExpanded ? '0' : `${requestsDiv.scrollHeight + 100}px`;
      requestsDiv.style.overflow = isExpanded ? 'hidden' : '';
      header.setAttribute('aria-expanded', !isExpanded);
    });

    // Request click → load into builder
    item.querySelectorAll('.request-item').forEach(reqItem => {
      reqItem.addEventListener('click', () => {
        loadRequestIntoBuilder(reqItem.dataset.requestId, reqItem.dataset.collectionId);
      });
    });

    // Collection menu button
    item.querySelector('[data-action="collection-menu"]').addEventListener('click', (e) => {
      e.stopPropagation();
      showCollectionContextMenu(e, collection);
    });

    // Add request button
    item.querySelector('[data-action="add-request"]').addEventListener('click', () => {
      saveCurrentRequestToCollection(collection.id);
    });

    container.appendChild(item);
  }
}

function filterCollections(tree, query) {
  tree.querySelectorAll('.collection-item').forEach(item => {
    const name = item.querySelector('.collection-name').textContent.toLowerCase();
    const requests = item.querySelectorAll('.request-item');
    let hasMatch = name.includes(query);

    requests.forEach(req => {
      const reqName = req.querySelector('.request-name').textContent.toLowerCase();
      const reqMatch = reqName.includes(query);
      req.style.display = reqMatch || !query ? '' : 'none';
      if (reqMatch) hasMatch = true;
    });

    item.style.display = hasMatch ? '' : 'none';
  });
}

async function promptCreateCollection() {
  const name = prompt('Collection name:');
  if (!name || !name.trim()) return;

  try {
    await api.createCollection(name.trim());
    await loadCollections();
    showToast(`Collection "${name.trim()}" created`, 'success');
  } catch (err) {
    showToast('Failed to create collection: ' + err.message, 'error');
  }
}

function showCollectionContextMenu(event, collection) {
  // Remove existing context menu
  document.querySelectorAll('.context-menu').forEach(m => m.remove());

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <button class="context-menu-item" data-action="rename">✏️ Rename</button>
    <button class="context-menu-item" data-action="duplicate">📋 Duplicate</button>
    <div class="context-menu-separator"></div>
    <button class="context-menu-item danger" data-action="delete">🗑️ Delete</button>
  `;

  // Position near the click
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  document.body.appendChild(menu);

  // Actions
  menu.querySelector('[data-action="rename"]').addEventListener('click', async () => {
    menu.remove();
    const newName = prompt('New name:', collection.name);
    if (newName && newName.trim()) {
      try {
        await api.updateCollection(collection.id, { name: newName.trim() });
        await loadCollections();
        showToast('Collection renamed', 'success');
      } catch (err) {
        showToast('Failed to rename: ' + err.message, 'error');
      }
    }
  });

  menu.querySelector('[data-action="duplicate"]').addEventListener('click', async () => {
    menu.remove();
    try {
      await api.createCollection(collection.name + ' (Copy)');
      await loadCollections();
      showToast('Collection duplicated', 'success');
    } catch (err) {
      showToast('Failed to duplicate: ' + err.message, 'error');
    }
  });

  menu.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    menu.remove();
    if (confirm(`Delete collection "${collection.name}" and all its requests?`)) {
      try {
        await api.deleteCollection(collection.id);
        await loadCollections();
        showToast(`Collection "${collection.name}" deleted`, 'success');
      } catch (err) {
        showToast('Failed to delete: ' + err.message, 'error');
      }
    }
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

function loadRequestIntoBuilder(requestId, collectionId) {
  const collections = getState('collections') || [];
  const collection = collections.find(c => c.id === collectionId);
  if (!collection) return;

  const request = (collection.requests || []).find(r => r.id === requestId);
  if (!request) return;

  // Mark active request in sidebar
  sidebarEl.querySelectorAll('.request-item').forEach(el => el.classList.remove('active'));
  const activeItem = sidebarEl.querySelector(`[data-request-id="${requestId}"]`);
  if (activeItem) activeItem.classList.add('active');

  // Update state — this triggers the request builder to re-render
  setState('activeRequest', {
    id: request.id,
    collectionId: collectionId,
    name: request.name,
    method: request.method || 'GET',
    url: request.url || '',
    headers: request.headers || [],
    params: request.params || [],
    body: request.body || { type: 'none', content: '' },
    auth: request.auth || { type: 'none' },
  });

  // Clear previous response
  setState('response', null);
}

async function saveCurrentRequestToCollection(collectionId) {
  const activeRequest = getState('activeRequest');
  if (!activeRequest.url) {
    showToast('Enter a URL first', 'warning');
    return;
  }

  const name = prompt('Request name:', `${activeRequest.method} ${activeRequest.url}`);
  if (!name) return;

  try {
    await api.createSavedRequest(collectionId, {
      ...activeRequest,
      name: name.trim(),
    });
    await loadCollections();
    showToast('Request saved', 'success');
  } catch (err) {
    showToast('Failed to save request: ' + err.message, 'error');
  }
}

// ============================================================================
// History Tab
// ============================================================================

function renderHistoryTab() {
  const panel = sidebarEl.querySelector('#sidebar-panel');
  const actions = sidebarEl.querySelector('#sidebar-actions');
  const history = getState('history') || [];

  if (history.length === 0) {
    panel.innerHTML = `
      <div class="empty-state" style="padding: 24px 16px;">
        <div class="empty-state-icon">🕐</div>
        <div class="empty-state-title">No history yet</div>
        <div class="empty-state-text">Send a request and it will appear here</div>
      </div>
    `;
  } else {
    panel.innerHTML = history.map(entry => `
      <div class="history-item" data-history-id="${entry.id}" tabindex="0">
        <span class="method-badge ${getMethodClass(entry.method)}">${entry.method}</span>
        <span class="history-url">${escapeHtml(entry.url)}</span>
        <span class="history-time">${formatRelativeTime(entry.timestamp)}</span>
      </div>
    `).join('');

    // Click to replay
    panel.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const entry = history.find(h => h.id === item.dataset.historyId);
        if (entry) {
          setState('activeRequest', {
            method: entry.method || 'GET',
            url: entry.url || '',
            headers: entry.headers || [],
            params: entry.params || [],
            body: entry.body || { type: 'none', content: '' },
            auth: entry.auth || { type: 'none' },
          });
          setState('response', null);
          showToast('Request loaded from history', 'info');
        }
      });
    });
  }

  actions.innerHTML = history.length > 0 ? `
    <button class="btn btn-secondary btn-sm" style="width:100%;" id="clear-history-btn">
      Clear History
    </button>
  ` : '';

  if (history.length > 0) {
    actions.querySelector('#clear-history-btn').addEventListener('click', () => {
      if (confirm('Clear all history?')) {
        clearHistory();
        showToast('History cleared', 'info');
      }
    });
  }
}

// ============================================================================
// Environments Tab
// ============================================================================

function renderEnvironmentsTab() {
  const panel = sidebarEl.querySelector('#sidebar-panel');
  const actions = sidebarEl.querySelector('#sidebar-actions');
  const environments = getState('environments') || [];

  if (environments.length === 0) {
    panel.innerHTML = `
      <div class="empty-state" style="padding: 24px 16px;">
        <div class="empty-state-icon">🌍</div>
        <div class="empty-state-title">No environments</div>
        <div class="empty-state-text">Create an environment to define reusable variables like {{BASE_URL}}</div>
      </div>
    `;
  } else {
    panel.innerHTML = environments.map(env => `
      <div class="collection-item" data-env-id="${env.id}">
        <div class="collection-header" tabindex="0">
          <span class="caret">▶</span>
          <span class="collection-name">${escapeHtml(env.name)}</span>
          <span class="collection-count">${(env.variables || []).length} vars</span>
          <button class="btn-icon btn-sm" data-action="env-menu" data-id="${env.id}" aria-label="Environment options">⋮</button>
        </div>
        <div class="collection-requests" style="max-height:0;overflow:hidden;">
          ${(env.variables || []).map(v => `
            <div class="request-item" style="cursor:default;">
              <span class="text-mono text-xs" style="color: var(--accent-secondary);">{{${escapeHtml(v.key)}}}</span>
              <span class="text-mono text-xs" style="flex:1;overflow:hidden;text-overflow:ellipsis;">= ${escapeHtml(v.value)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    // Toggle expand/collapse for each environment
    panel.querySelectorAll('.collection-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="env-menu"]')) return;
        const caret = header.querySelector('.caret');
        const vars = header.nextElementSibling;
        const isExpanded = caret.classList.contains('open');
        caret.classList.toggle('open');
        vars.style.maxHeight = isExpanded ? '0' : `${vars.scrollHeight + 50}px`;
        vars.style.overflow = isExpanded ? 'hidden' : '';
      });
    });

    // Environment context menus
    panel.querySelectorAll('[data-action="env-menu"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const env = environments.find(en => en.id === btn.dataset.id);
        if (env) showEnvironmentContextMenu(e, env);
      });
    });
  }

  actions.innerHTML = `
    <button class="btn btn-primary btn-sm" style="width:100%;" id="create-env-btn">
      + New Environment
    </button>
  `;

  actions.querySelector('#create-env-btn').addEventListener('click', promptCreateEnvironment);
}

async function promptCreateEnvironment() {
  const name = prompt('Environment name (e.g., "Local", "Staging"):');
  if (!name || !name.trim()) return;

  try {
    await api.createEnvironment(name.trim(), [
      { key: 'BASE_URL', value: 'http://localhost:3000', enabled: true },
    ]);
    await loadEnvironments();
    showToast(`Environment "${name.trim()}" created`, 'success');
  } catch (err) {
    showToast('Failed to create environment: ' + err.message, 'error');
  }
}

function showEnvironmentContextMenu(event, env) {
  document.querySelectorAll('.context-menu').forEach(m => m.remove());

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <button class="context-menu-item" data-action="edit">✏️ Edit Variables</button>
    <button class="context-menu-item" data-action="rename">📝 Rename</button>
    <div class="context-menu-separator"></div>
    <button class="context-menu-item danger" data-action="delete">🗑️ Delete</button>
  `;

  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  document.body.appendChild(menu);

  menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
    menu.remove();
    // Dispatch custom event for the environment manager modal
    window.dispatchEvent(new CustomEvent('edit-environment', { detail: env }));
  });

  menu.querySelector('[data-action="rename"]').addEventListener('click', async () => {
    menu.remove();
    const newName = prompt('New name:', env.name);
    if (newName && newName.trim()) {
      try {
        await api.updateEnvironment(env.id, { name: newName.trim() });
        await loadEnvironments();
        showToast('Environment renamed', 'success');
      } catch (err) {
        showToast('Failed to rename: ' + err.message, 'error');
      }
    }
  });

  menu.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    menu.remove();
    if (confirm(`Delete environment "${env.name}"?`)) {
      try {
        await api.deleteEnvironment(env.id);
        await loadEnvironments();
        showToast(`Environment "${env.name}" deleted`, 'success');
      } catch (err) {
        showToast('Failed to delete: ' + err.message, 'error');
      }
    }
  });

  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

// ============================================================================
// Sidebar Toggle
// ============================================================================

export function toggleSidebar() {
  const collapsed = !getState('sidebarCollapsed');
  setState('sidebarCollapsed', collapsed);
}

function updateCollapsedState(collapsed) {
  sidebarEl.classList.toggle('collapsed', collapsed);
  overlayEl.classList.toggle('visible', !collapsed && window.innerWidth <= 1024);
}

// ============================================================================
// Public: Load environments (called from app.js)
// ============================================================================

export async function loadEnvironments() {
  try {
    const environments = await api.getEnvironments();
    setState('environments', environments);
  } catch (err) {
    showToast('Failed to load environments: ' + err.message, 'error');
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
