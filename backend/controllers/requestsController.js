/**
 * Requests Controller — CRUD operations for saved requests within collections.
 * 
 * Requests are stored INSIDE their parent collection's `requests` array
 * in collections.json. This keeps related data together and avoids cross-file
 * lookups (simpler than a separate requests.json with foreign keys).
 * 
 * Data shape of a saved request:
 * {
 *   id: "uuid",
 *   name: "Get All Users",
 *   method: "GET",
 *   url: "{{BASE_URL}}/api/users",
 *   headers: [{ key: "Authorization", value: "Bearer {{TOKEN}}", enabled: true }],
 *   params: [{ key: "page", value: "1", enabled: true }],
 *   body: { type: "json", content: '{"name":"test"}' },
 *   auth: { type: "bearer", token: "{{TOKEN}}" },
 *   createdAt: "ISO",
 *   updatedAt: "ISO"
 * }
 */

const { v4: uuidv4 } = require('uuid');
const storage = require('../utils/storageManager');
const config = require('../config');

/**
 * GET /api/collections/:collectionId/requests
 * Lists all requests in a collection.
 */
function listRequests(req, res, next) {
  const { collectionId } = req.params;

  const collections = storage.read(config.STORAGE.collections);
  const collection = collections.find(c => c.id === collectionId);

  if (!collection) {
    const err = new Error(`Collection with id "${collectionId}" not found`);
    err.status = 404;
    return next(err);
  }

  res.json(collection.requests || []);
}

/**
 * POST /api/collections/:collectionId/requests
 * Saves a new request inside a collection.
 */
function createRequest(req, res, next) {
  const { collectionId } = req.params;
  const { name, method, url, headers, params, body, auth } = req.body;

  const collections = storage.read(config.STORAGE.collections);
  const collection = collections.find(c => c.id === collectionId);

  if (!collection) {
    const err = new Error(`Collection with id "${collectionId}" not found`);
    err.status = 404;
    return next(err);
  }

  const newRequest = {
    id: uuidv4(),
    name: (name || `${method} ${url}`).trim(),
    method: method.toUpperCase(),
    url,
    headers: headers || [],
    params: params || [],
    body: body || { type: 'none', content: '' },
    auth: auth || { type: 'none' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Initialize requests array if it doesn't exist
  if (!collection.requests) {
    collection.requests = [];
  }

  collection.requests.push(newRequest);
  collection.updatedAt = new Date().toISOString();

  storage.write(config.STORAGE.collections, collections);

  res.status(201).json(newRequest);
}

/**
 * PUT /api/requests/:id
 * Updates a saved request (searches across all collections to find it).
 */
function updateRequest(req, res, next) {
  const { id } = req.params;
  const updates = req.body;

  const collections = storage.read(config.STORAGE.collections);

  // Find the request across all collections
  let found = false;
  for (const collection of collections) {
    if (!collection.requests) continue;
    const reqIndex = collection.requests.findIndex(r => r.id === id);
    if (reqIndex !== -1) {
      // Merge updates into the existing request
      const existing = collection.requests[reqIndex];
      collection.requests[reqIndex] = {
        ...existing,
        ...updates,
        id: existing.id,  // Never allow ID to be changed
        createdAt: existing.createdAt,  // Preserve creation date
        updatedAt: new Date().toISOString(),
      };
      collection.updatedAt = new Date().toISOString();
      found = true;

      storage.write(config.STORAGE.collections, collections);
      return res.json(collection.requests[reqIndex]);
    }
  }

  if (!found) {
    const err = new Error(`Request with id "${id}" not found`);
    err.status = 404;
    return next(err);
  }
}

/**
 * DELETE /api/requests/:id
 * Deletes a saved request (searches across all collections to find it).
 */
function deleteRequest(req, res, next) {
  const { id } = req.params;

  const collections = storage.read(config.STORAGE.collections);

  // Find and remove the request across all collections
  for (const collection of collections) {
    if (!collection.requests) continue;
    const reqIndex = collection.requests.findIndex(r => r.id === id);
    if (reqIndex !== -1) {
      const [deleted] = collection.requests.splice(reqIndex, 1);
      collection.updatedAt = new Date().toISOString();

      storage.write(config.STORAGE.collections, collections);
      return res.json({ message: `Request "${deleted.name}" deleted`, id: deleted.id });
    }
  }

  const err = new Error(`Request with id "${id}" not found`);
  err.status = 404;
  return next(err);
}

module.exports = { listRequests, createRequest, updateRequest, deleteRequest };
