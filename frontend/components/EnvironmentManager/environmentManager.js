/**
 * Environment Manager Component — Modal for editing environment variables.
 * 
 * This is triggered via the sidebar's "Edit Variables" action on an environment.
 * Shows a modal with a key-value editor for the environment's variables.
 */

import * as api from '../../services/apiClient.js';
import { getState, setState } from '../../services/stateManager.js';
import { showToast } from '../Toast/toast.js';
import { loadEnvironments } from '../Sidebar/sidebar.js';

/**
 * Initializes the environment manager.
 * Listens for custom 'edit-environment' events dispatched from the sidebar.
 */
export function initEnvironmentManager() {
  window.addEventListener('edit-environment', (e) => {
    showEditModal(e.detail);
  });
}

/**
 * Shows the environment variable editor modal.
 * @param {Object} env - The environment to edit
 */
function showEditModal(env) {
  // Remove any existing modal
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

  const variables = [...(env.variables || [])];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Edit Environment: ${escapeHtml(env.name)}</span>
        <button class="btn-icon" id="modal-close" aria-label="Close modal">✕</button>
      </div>
      <div class="modal-body">
        <p class="text-sm text-secondary mb-4">
          Define variables that can be used in requests with <code>{{VARIABLE_NAME}}</code> syntax.
        </p>
        <div class="kv-editor" id="env-vars-editor">
          ${renderVariableRows(variables)}
        </div>
        <button class="kv-add-btn mt-2" id="add-env-var-btn">+ Add Variable</button>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-save">Save Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close handlers
  overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Add variable
  overlay.querySelector('#add-env-var-btn').addEventListener('click', () => {
    variables.push({ key: '', value: '', enabled: true });
    overlay.querySelector('#env-vars-editor').innerHTML = renderVariableRows(variables);
    bindVarInputEvents(overlay, variables);
  });

  // Save
  overlay.querySelector('#modal-save').addEventListener('click', async () => {
    // Read current values from inputs
    readVariableValues(overlay, variables);

    try {
      await api.updateEnvironment(env.id, { variables });
      await loadEnvironments();
      overlay.remove();
      showToast('Environment updated', 'success');
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'error');
    }
  });

  // Bind input events
  bindVarInputEvents(overlay, variables);
}

function renderVariableRows(variables) {
  return variables.map((v, i) => `
    <div class="kv-row" data-index="${i}">
      <input type="checkbox" class="checkbox kv-checkbox" 
        ${v.enabled !== false ? 'checked' : ''}
        data-field="enabled" data-index="${i}" aria-label="Enable variable" />
      <input type="text" class="input input-mono kv-key" 
        value="${escapeAttr(v.key || '')}" 
        placeholder="VARIABLE_NAME"
        data-field="key" data-index="${i}" aria-label="Variable name" />
      <input type="text" class="input input-mono kv-value" 
        value="${escapeAttr(v.value || '')}" 
        placeholder="value"
        data-field="value" data-index="${i}" aria-label="Variable value" />
      <div class="kv-actions">
        <button class="btn-icon btn-sm" data-action="remove" data-index="${i}" 
          aria-label="Remove variable" title="Remove">✕</button>
      </div>
    </div>
  `).join('');
}

function bindVarInputEvents(overlay, variables) {
  // Remove buttons
  overlay.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      variables.splice(idx, 1);
      overlay.querySelector('#env-vars-editor').innerHTML = renderVariableRows(variables);
      bindVarInputEvents(overlay, variables);
    });
  });
}

function readVariableValues(overlay, variables) {
  overlay.querySelectorAll('.kv-row').forEach((row, i) => {
    const key = row.querySelector('.kv-key');
    const value = row.querySelector('.kv-value');
    const checkbox = row.querySelector('.kv-checkbox');
    if (key && value && i < variables.length) {
      variables[i].key = key.value;
      variables[i].value = value.value;
      variables[i].enabled = checkbox ? checkbox.checked : true;
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
