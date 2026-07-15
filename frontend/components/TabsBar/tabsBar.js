/**
 * Tabs Bar Component — Top navigation with open request tabs.
 * 
 * Features:
 * - Multi-tab editing (like a code editor)
 * - New Request (+) button
 * - Environment selector dropdown
 * - Dark/Light mode toggle
 * - Sidebar toggle button
 */

import { getState, setState, subscribe, toggleTheme } from '../../services/stateManager.js';
import { getMethodClass, generateId } from '../../utils/helpers.js';
import { toggleSidebar } from '../Sidebar/sidebar.js';

let tabsBarEl = null;

/**
 * Initializes the tabs bar component.
 * @param {HTMLElement} container - The top-bar DOM element
 */
export function initTabsBar(container) {
  tabsBarEl = container;
  renderTabsBar();

  // Subscribe to state changes that affect the tabs bar
  subscribe('openTabs', renderOpenTabs);
  subscribe('activeTabId', renderOpenTabs);
  subscribe('environments', renderEnvironmentSelector);
  subscribe('activeEnvironmentId', renderEnvironmentSelector);
  subscribe('theme', updateThemeToggle);
}

function renderTabsBar() {
  tabsBarEl.innerHTML = `
    <div class="top-bar-left">
      <button class="btn-icon" id="sidebar-toggle" aria-label="Toggle sidebar" title="Toggle sidebar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect y="1" width="16" height="2" rx="1"/>
          <rect y="7" width="16" height="2" rx="1"/>
          <rect y="13" width="16" height="2" rx="1"/>
        </svg>
      </button>
      <div class="app-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        Postman Lite
      </div>
    </div>
    <div class="top-bar-center" id="open-tabs-container">
    </div>
    <div class="top-bar-right">
      <div class="env-selector" id="env-selector-container"></div>
      <button class="btn-icon" id="theme-toggle" aria-label="Toggle theme" title="Toggle dark/light mode">
        ${getState('theme') === 'dark' ? '🌙' : '☀️'}
      </button>
      <button class="btn btn-primary btn-sm" id="new-request-btn" title="New request (Ctrl+N)">
        + New
      </button>
    </div>
  `;

  // Event listeners
  tabsBarEl.querySelector('#sidebar-toggle').addEventListener('click', toggleSidebar);
  tabsBarEl.querySelector('#theme-toggle').addEventListener('click', () => toggleTheme());
  tabsBarEl.querySelector('#new-request-btn').addEventListener('click', createNewTab);

  renderOpenTabs();
  renderEnvironmentSelector();
}

/**
 * Creates a new request tab.
 */
export function createNewTab() {
  const tabs = getState('openTabs') || [];
  const newTab = {
    id: generateId(),
    name: 'New Request',
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    body: { type: 'none', content: '' },
    auth: { type: 'none' },
  };

  tabs.push(newTab);
  setState('openTabs', [...tabs]);
  switchToTab(newTab.id);
}

/**
 * Switches to a tab by ID.
 */
export function switchToTab(tabId) {
  const tabs = getState('openTabs') || [];
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  setState('activeTabId', tabId);
  setState('activeRequest', {
    id: tab.savedRequestId || null,
    collectionId: tab.collectionId || null,
    name: tab.name,
    method: tab.method || 'GET',
    url: tab.url || '',
    headers: tab.headers || [],
    params: tab.params || [],
    body: tab.body || { type: 'none', content: '' },
    auth: tab.auth || { type: 'none' },
  });
  setState('response', null);
}

/**
 * Updates the current tab with the active request state.
 */
export function updateCurrentTab() {
  const tabs = getState('openTabs') || [];
  const activeTabId = getState('activeTabId');
  const activeRequest = getState('activeRequest');

  const tabIndex = tabs.findIndex(t => t.id === activeTabId);
  if (tabIndex === -1) return;

  tabs[tabIndex] = {
    ...tabs[tabIndex],
    name: activeRequest.name || `${activeRequest.method} ${activeRequest.url}` || 'New Request',
    method: activeRequest.method,
    url: activeRequest.url,
    headers: activeRequest.headers,
    params: activeRequest.params,
    body: activeRequest.body,
    auth: activeRequest.auth,
  };

  setState('openTabs', [...tabs]);
}

/**
 * Closes a tab by ID.
 */
function closeTab(tabId) {
  let tabs = getState('openTabs') || [];
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  tabs = tabs.filter(t => t.id !== tabId);
  setState('openTabs', [...tabs]);

  // If the closed tab was active, switch to the nearest tab or create a new one
  if (getState('activeTabId') === tabId) {
    if (tabs.length > 0) {
      const newIndex = Math.min(index, tabs.length - 1);
      switchToTab(tabs[newIndex].id);
    } else {
      createNewTab();
    }
  }
}

/**
 * Renders the open tabs in the top bar.
 */
function renderOpenTabs() {
  const container = tabsBarEl.querySelector('#open-tabs-container');
  if (!container) return;

  const tabs = getState('openTabs') || [];
  const activeTabId = getState('activeTabId');

  if (tabs.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = tabs.map(tab => {
    const isActive = tab.id === activeTabId;
    const displayName = tab.name || tab.url || 'New Request';
    const truncatedName = displayName.length > 25 ? displayName.slice(0, 25) + '...' : displayName;

    return `
      <div class="open-tab ${isActive ? 'active' : ''}" data-tab-id="${tab.id}" title="${escapeHtml(displayName)}">
        <span class="method-badge ${getMethodClass(tab.method)}" style="font-size:0.6rem;padding:0 4px;">${tab.method || 'GET'}</span>
        <span class="tab-name">${escapeHtml(truncatedName)}</span>
        <span class="tab-close" data-close-tab="${tab.id}" title="Close tab">×</span>
      </div>
    `;
  }).join('');

  // Tab click handlers
  container.querySelectorAll('.open-tab').forEach(tabEl => {
    tabEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-close-tab]')) {
        closeTab(e.target.closest('[data-close-tab]').dataset.closeTab);
        return;
      }
      switchToTab(tabEl.dataset.tabId);
    });
  });
}

/**
 * Renders the environment selector dropdown.
 */
function renderEnvironmentSelector() {
  const container = tabsBarEl.querySelector('#env-selector-container');
  if (!container) return;

  const environments = getState('environments') || [];
  const activeEnvId = getState('activeEnvironmentId');

  container.innerHTML = `
    <select class="env-select" id="env-select" aria-label="Select environment" title="Active environment">
      <option value="">No Environment</option>
      ${environments.map(env => `
        <option value="${env.id}" ${env.id === activeEnvId ? 'selected' : ''}>
          ${escapeHtml(env.name)}
        </option>
      `).join('')}
    </select>
  `;

  container.querySelector('#env-select').addEventListener('change', (e) => {
    setState('activeEnvironmentId', e.target.value || null);
  });
}

function updateThemeToggle() {
  const btn = tabsBarEl.querySelector('#theme-toggle');
  if (btn) {
    btn.textContent = getState('theme') === 'dark' ? '🌙' : '☀️';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
