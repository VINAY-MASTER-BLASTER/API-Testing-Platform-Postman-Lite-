/**
 * API Client — Centralized HTTP client for backend communication.
 * 
 * All backend API calls go through this module. This keeps the fetch() calls
 * in one place and makes it easy to:
 * - Add error handling consistently
 * - Change the base URL in one place
 * - Add request/response interceptors if needed
 */

// Base URL for the backend API.
// In production, the frontend is served by the same Express server, so we can
// use relative URLs. In development, you might need to change this.
const BASE_URL = window.location.origin;

/**
 * Generic fetch wrapper with error handling.
 */
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok && !endpoint.includes('/api/proxy')) {
      // For non-proxy endpoints, throw on HTTP errors
      throw new Error(data.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Cannot connect to the backend server. Is it running?');
    }
    throw err;
  }
}

// ============================================================================
// Proxy API (core feature)
// ============================================================================

/**
 * Sends a request through the backend proxy.
 * This is the main feature — the frontend sends the request config,
 * the backend executes it and returns the response.
 * 
 * @param {Object} requestConfig - The request to execute
 * @returns {Promise<Object>} Normalized response or error
 */
export async function sendProxyRequest(requestConfig) {
  return request('/api/proxy', {
    method: 'POST',
    body: JSON.stringify(requestConfig),
  });
}

// ============================================================================
// Collections API
// ============================================================================

export async function getCollections() {
  return request('/api/collections');
}

export async function createCollection(name) {
  return request('/api/collections', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function updateCollection(id, updates) {
  return request(`/api/collections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteCollection(id) {
  return request(`/api/collections/${id}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Requests API (within collections)
// ============================================================================

export async function getRequests(collectionId) {
  return request(`/api/collections/${collectionId}/requests`);
}

export async function createSavedRequest(collectionId, requestData) {
  return request(`/api/collections/${collectionId}/requests`, {
    method: 'POST',
    body: JSON.stringify(requestData),
  });
}

export async function updateSavedRequest(requestId, updates) {
  return request(`/api/requests/${requestId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteSavedRequest(requestId) {
  return request(`/api/requests/${requestId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Environments API
// ============================================================================

export async function getEnvironments() {
  return request('/api/environments');
}

export async function createEnvironment(name, variables = []) {
  return request('/api/environments', {
    method: 'POST',
    body: JSON.stringify({ name, variables }),
  });
}

export async function updateEnvironment(id, updates) {
  return request(`/api/environments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteEnvironment(id) {
  return request(`/api/environments/${id}`, {
    method: 'DELETE',
  });
}
