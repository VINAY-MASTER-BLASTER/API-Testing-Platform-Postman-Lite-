/**
 * ============================================================================
 *  POSTMAN LITE — Frontend Entry Point
 * ============================================================================
 * 
 * ARCHITECTURE OVERVIEW:
 * This is the main entry point for the Postman Lite frontend — a single-page
 * application built with pure vanilla JavaScript (no frameworks).
 * 
 * COMPONENT STRUCTURE:
 * ┌─────────────────────────────────────────────────────────┐
 * │ Top Bar (TabsBar)                                       │
 * │  [☰ sidebar] [logo] [open tabs...] [env selector] [🌙] │
 * ├─────────┬───────────────────────────────────────────────┤
 * │ Sidebar │ Request Builder (workspace)                   │
 * │         │  [METHOD v] [URL_______________] [Send]       │
 * │ Colls   │  [Params | Headers | Auth | Body | Code]      │
 * │ History │  [tab content area]                           │
 * │ Envs    ├───────────────────────────────────────────────┤
 * │         │ Response Viewer                               │
 * │         │  [200 OK] [120ms] [1.2KB] [Copy] [Download]  │
 * │         │  [Pretty | Raw | Headers | Preview]           │
 * │         │  [response content]                           │
 * └─────────┴───────────────────────────────────────────────┘
 * 
 * STATE MANAGEMENT: Simple pub/sub pattern (stateManager.js)
 * API CALLS: Centralized apiClient.js → backend /api/* endpoints
 * PERSISTENCE: localStorage (history, theme) + backend JSON files (collections, envs)
 * 
 * KEYBOARD SHORTCUTS:
 *   Ctrl+Enter → Send request
 *   Ctrl+N     → New request tab
 *   Ctrl+S     → Save current request
 * ============================================================================
 */

import { initState, subscribe, getState } from './services/stateManager.js';
import { initSidebar, loadEnvironments } from './components/Sidebar/sidebar.js';
import { initTabsBar, createNewTab } from './components/TabsBar/tabsBar.js';
import { initRequestBuilder } from './components/RequestBuilder/requestBuilder.js';
import { initResponseViewer } from './components/ResponseViewer/responseViewer.js';
import { initEnvironmentManager } from './components/EnvironmentManager/environmentManager.js';
import { showToast } from './components/Toast/toast.js';

/**
 * Main initialization function — called when the DOM is ready.
 */
function init() {
  console.log('⚡ Postman Lite initializing...');

  // --- 1. Initialize state (loads persisted values from localStorage) ---
  initState();

  // --- 2. Get DOM references ---
  const topBar = document.getElementById('top-bar');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const requestPanel = document.getElementById('request-panel');
  const responsePanel = document.getElementById('response-panel');

  // --- 3. Initialize components ---
  // Each component takes ownership of its DOM container and manages
  // its own rendering, event listeners, and state subscriptions.

  initTabsBar(topBar);
  initSidebar(sidebar, sidebarOverlay);
  initRequestBuilder(requestPanel);
  initResponseViewer(responsePanel);
  initEnvironmentManager();

  // --- 4. Load data from backend ---
  loadEnvironments();

  // --- 5. Create initial request tab if none exist ---
  if (!getState('openTabs') || getState('openTabs').length === 0) {
    createNewTab();
  }

  // --- 6. Register keyboard shortcuts ---
  document.addEventListener('keydown', handleKeyboardShortcuts);

  // --- 7. Handle window resize for responsive sidebar ---
  window.addEventListener('resize', handleResize);

  console.log('✅ Postman Lite ready!');
}

/**
 * Global keyboard shortcut handler.
 */
function handleKeyboardShortcuts(e) {
  // Ctrl+Enter → Send request
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
    }
  }

  // Ctrl+N → New request tab
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault();
    createNewTab();
  }

  // Ctrl+S → Save current request (prompt for collection)
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    showToast('Use the collection sidebar to save requests', 'info');
  }

  // Escape → Close any open modals
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    document.querySelectorAll('.context-menu').forEach(m => m.remove());
  }
}

/**
 * Handles window resize for responsive sidebar behavior.
 */
function handleResize() {
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  if (window.innerWidth > 1024) {
    sidebarOverlay.classList.remove('visible');
  }
}

// --- Start the app when DOM is ready ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
