/**
 * Toast Notification System.
 * 
 * Provides non-intrusive feedback for user actions (save, delete, errors).
 * Toasts auto-dismiss after a configurable duration and stack vertically.
 * 
 * Usage:
 *   import { showToast } from './toast.js';
 *   showToast('Request saved successfully', 'success');
 *   showToast('Failed to connect', 'error');
 */

let container = null;

// Icons for each toast type (using simple emoji for zero dependencies)
const ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

/**
 * Ensures the toast container exists in the DOM.
 */
function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('role', 'alert');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Shows a toast notification.
 * 
 * @param {string} message - The message to display
 * @param {'success'|'error'|'info'|'warning'} type - Toast type (affects color and icon)
 * @param {number} duration - Auto-dismiss duration in ms (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  const parent = ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Dismiss notification">×</button>
  `;

  // Close button handler
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  parent.appendChild(toast);

  // Auto-dismiss after duration
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }

  return toast;
}

/**
 * Removes a toast with a slide-out animation.
 */
function removeToast(toast) {
  if (!toast || !toast.parentNode) return;

  toast.classList.add('removing');
  setTimeout(() => {
    toast.remove();
  }, 300); // Match the CSS animation duration
}

/**
 * Escapes HTML to prevent XSS in toast messages.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
