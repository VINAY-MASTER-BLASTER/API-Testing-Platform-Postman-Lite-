/**
 * Collections Controller — CRUD operations for request collections.
 * 
 * Collections are groups of saved API requests (like folders in Postman).
 * Each collection has a unique ID, a name, and an array of request IDs.
 * 
 * Data shape in collections.json:
 * [
 *   { id: "uuid", name: "User APIs", requestIds: ["req-uuid-1", "req-uuid-2"], createdAt: "ISO", updatedAt: "ISO" },
 *   ...
 * ]
 */

const { v4: uuidv4 } = require('uuid');
const storage = require('../utils/storageManager');
const config = require('../config');

/**
 * GET /api/collections
 * Returns all collections.
 */
function listCollections(req, res) {
  const collections = storage.read(config.STORAGE.collections);
  res.json(collections);
}

/**
 * POST /api/collections
 * Creates a new collection. Body must include { name: "..." }.
 */
function createCollection(req, res) {
  const { name } = req.body;

  const collections = storage.read(config.STORAGE.collections);

  const newCollection = {
    id: uuidv4(),
    name: name.trim(),
    requests: [],   // Requests are stored inline for simplicity
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  collections.push(newCollection);
  storage.write(config.STORAGE.collections, collections);

  res.status(201).json(newCollection);
}

/**
 * PUT /api/collections/:id
 * Updates a collection (rename, reorder requests, etc.)
 */
function updateCollection(req, res, next) {
  const { id } = req.params;
  const updates = req.body;

  const collections = storage.read(config.STORAGE.collections);
  const index = collections.findIndex(c => c.id === id);

  if (index === -1) {
    const err = new Error(`Collection with id "${id}" not found`);
    err.status = 404;
    return next(err);
  }

  // Merge updates (only allow name and requests to be updated)
  if (updates.name !== undefined) {
    collections[index].name = updates.name.trim();
  }
  if (updates.requests !== undefined) {
    collections[index].requests = updates.requests;
  }

  collections[index].updatedAt = new Date().toISOString();

  storage.write(config.STORAGE.collections, collections);

  res.json(collections[index]);
}

/**
 * DELETE /api/collections/:id
 * Deletes a collection and all its requests.
 */
function deleteCollection(req, res, next) {
  const { id } = req.params;

  const collections = storage.read(config.STORAGE.collections);
  const index = collections.findIndex(c => c.id === id);

  if (index === -1) {
    const err = new Error(`Collection with id "${id}" not found`);
    err.status = 404;
    return next(err);
  }

  // Remove the collection
  const [deleted] = collections.splice(index, 1);
  storage.write(config.STORAGE.collections, collections);

  res.json({ message: `Collection "${deleted.name}" deleted`, id: deleted.id });
}

module.exports = { listCollections, createCollection, updateCollection, deleteCollection };
